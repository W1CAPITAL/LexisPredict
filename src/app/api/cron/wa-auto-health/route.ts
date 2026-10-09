import {NextResponse} from 'next/server';
import {timingSafeEqual} from 'node:crypto';
import {getSupabaseAdmin} from '@/lib/server-db';
import {waAutoForOwner} from '@/lib/wa-auto-client';
import {resolveWaAutoPermissions} from '@/lib/wa-auto-permissions';

export const dynamic='force-dynamic';
export const maxDuration=30;

/** Internal readiness check. This uses precisely the same WA.Auto transport
 * credentials as automated sends, without sending a WhatsApp message.
 */
export async function GET(request:Request){
  const secret=String(process.env.WA_MOVEMENT_CRON_SECRET||'');
  const supplied=String(request.headers.get('authorization')||'').replace(/^Bearer\s+/i,'').trim();
  if(secret.length<20||secret.length!==supplied.length||
      !timingSafeEqual(Buffer.from(secret),Buffer.from(supplied)))
    return NextResponse.json({ok:false,error:'Unauthorized'},{status:401});
  try{
    const db=await getSupabaseAdmin();
    const {data:settings,error}=await db.from('wa_daily_return_settings')
      .select('empresa_id,owner_auth_id,consent_attested')
      .eq('consent_attested',true).not('owner_auth_id','is',null).limit(3);
    if(error)return NextResponse.json({ok:false,error:'Settings unavailable'},{status:503});
    const checked=[];
    for(const config of settings||[]){
      const {data:owner}=await db.from('usuarios')
        .select('empresa_id,cargo')
        .eq('empresa_id',config.empresa_id)
        .eq('auth_user_id',config.owner_auth_id).maybeSingle();
      if(!owner||!resolveWaAutoPermissions({cargo:owner.cargo}).canManage){
        checked.push({ok:false,reason:'unverified_owner'});
        continue;
      }
      const result=await waAutoForOwner(config.owner_auth_id,config.empresa_id);
      checked.push({ok:result.ok===true,
        status:result.ok?'ready':'offline',
        httpStatus:result.ok?200:(result.httpStatus||null),
        reason:result.ok?'authenticated':'integration_or_session_unavailable'});
    }
    return NextResponse.json({ok:checked.length>0&&checked.every(x=>x.ok),checks:checked},
      {headers:{'Cache-Control':'private, no-store'}});
  }catch{
    return NextResponse.json({ok:false,error:'Health check unavailable'},{status:503});
  }
}

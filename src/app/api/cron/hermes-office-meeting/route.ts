import { NextResponse } from 'next/server';
import { timingSafeEqual } from 'node:crypto';
import { getSupabaseAdmin } from '@/lib/server-db';
import { runHermesCompanyMeeting,todayHermesBrazil } from '@/lib/hermes-company-service';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export const maxDuration=60;
function authorized(request:Request){
 const token=String(request.headers.get('authorization')||'').replace(/^Bearer\s+/i,'').trim();
 return [process.env.WA_DAILY_CRON_SECRET,process.env.CRON_SECRET]
   .filter((s):s is string=>typeof s==='string'&&s.length>=20)
   .some(secret=>token.length===secret.length&&timingSafeEqual(Buffer.from(token),Buffer.from(secret)));
}
/** Uma reunião consolidada por empresa/dia. Nenhum processo ou mensagem é alterado. */
export async function GET(request:Request){
 if(!authorized(request))return NextResponse.json({ok:false},{status:401});
 try{
  const day=todayHermesBrazil(),db=await getSupabaseAdmin();
  const {data,error}=await db.from('hermes_office_daily').select('empresa_id')
    .eq('day',day).eq('meeting_status','pending').limit(1);
  if(error)throw Error('Sem acesso à fila Hermes.');
  if(!data?.length)return NextResponse.json({ok:true,processed:0},{headers:{'Cache-Control':'no-store'}});
  const result=await runHermesCompanyMeeting(String(data[0].empresa_id),day);
  return NextResponse.json({ok:true,processed:result.alreadyDone?0:1,state:'state' in result?result.state:null},
    {headers:{'Cache-Control':'no-store'}});
 }catch{
  return NextResponse.json({ok:false,error:'Falha no resumo agendado.'},{status:503,headers:{'Cache-Control':'no-store'}});
 }
}

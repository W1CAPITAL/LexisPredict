import {NextResponse} from 'next/server';
import {timingSafeEqual} from 'node:crypto';
import {getSupabaseAdmin} from '@/lib/server-db';

export const dynamic='force-dynamic';
export const maxDuration=60;
function check(req:Request){
 const token=(req.headers.get('authorization')||'').replace(/^Bearer\s+/i,'').trim();
 return [process.env.CRON_SECRET,process.env.WA_MOVEMENT_CRON_SECRET]
  .filter((v):v is string=>typeof v==='string'&&v.length>=16)
  .some(s=>s.length===token.length&&timingSafeEqual(Buffer.from(s),Buffer.from(token)));
}
/** Single opted-in employee welcome, queued only on an authenticated WA bridge. */
export async function GET(req:Request){
 if(!check(req))return NextResponse.json({ok:false},{status:401});
 const db=await getSupabaseAdmin();
 const {data,error}=await db.rpc('lexis_queue_welcome_one');
 if(error){console.error('[welcome-cron]',error.code);return NextResponse.json({ok:false,error:'queue_unavailable'},{status:503})}
 return NextResponse.json({ok:true,queued:!!data});
}

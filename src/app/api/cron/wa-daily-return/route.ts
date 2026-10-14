import {NextResponse} from 'next/server';
import {timingSafeEqual} from 'node:crypto';
import {getSupabaseAdmin} from '@/lib/server-db';
import {brazilToday} from '@/lib/wa-daily-return-policy';
import {processNextDueReturn} from '@/lib/wa-daily-return-service';

export const dynamic='force-dynamic';
export const maxDuration=60;
function authenticated(request:Request){
 const secret=String(process.env.WA_DAILY_CRON_SECRET||process.env.CRON_SECRET||process.env.WA_MOVEMENT_CRON_SECRET||'');
 const token=String(request.headers.get('authorization')||'').replace(/^Bearer\s+/i,'').trim();
 return secret.length>=20 && token.length===secret.length &&
   timingSafeEqual(Buffer.from(secret),Buffer.from(token));
}
export async function GET(request:Request){
 if(!authenticated(request))return NextResponse.json({ok:false,error:'Unauthorized'},{status:401});
 const now=new Date();
 const weekday=new Intl.DateTimeFormat('en-US',{timeZone:'America/Sao_Paulo',weekday:'short'}).format(now);
 const hour=Number(new Intl.DateTimeFormat('en-GB',{timeZone:'America/Sao_Paulo',hour:'2-digit',hourCycle:'h23'}).format(now));
 if(['Sat','Sun'].includes(weekday)||hour<9||hour>=18)
   return NextResponse.json({ok:true,processed:false,reason:'outside_business_hours'});
 const db=await getSupabaseAdmin(),day=brazilToday(now);
 const {data:configs,error}=await db.from('wa_daily_return_settings')
   .select('empresa_id,interval_days').eq('enabled',true).limit(25);
 if(error)return NextResponse.json({ok:false,error:'Configuration unavailable'},{status:503});
 const started=Date.now();
 const MAX_PER_TICK=6, MAX_RUNTIME_MS=40000;
 let scanned=0, lastReason='no_due_cases_or_daily_limit', errorCount=0;
 for(const config of configs||[]){
  if(Date.now()-started>=MAX_RUNTIME_MS||scanned>=MAX_PER_TICK)break;
  const {count,error:countError}=await db.from('wa_daily_return_sends').select('id',{count:'exact',head:true})
    .eq('empresa_id',config.empresa_id).eq('local_day',day).eq('status','sent');
  if(countError||Number(count||0)>=120)continue;
  // No outbound messages from the scanner cron: it only checks/prepares.
  while(scanned<MAX_PER_TICK && Date.now()-started<MAX_RUNTIME_MS){
   const result=await processNextDueReturn(config.empresa_id,config.interval_days,true);
   if(!result.processed)break;
   scanned++;
   lastReason=String(result.reason||'checked');
   if(!result.ok)errorCount++;
  }
 }
 return NextResponse.json({ok:errorCount===0,processed:scanned>0,count:scanned,
   reason:scanned?lastReason:'no_due_cases_or_daily_limit',sent:false,
   elapsedMs:Date.now()-started},
   {headers:{'Cache-Control':'private, no-store'}});

}

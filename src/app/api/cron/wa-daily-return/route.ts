import {NextResponse} from 'next/server';
import {timingSafeEqual} from 'node:crypto';
import {getSupabaseAdmin} from '@/lib/server-db';
import {brazilToday} from '@/lib/wa-daily-return-policy';
import {processNextDueReturn,dispatchPreparedDailyReturns} from '@/lib/wa-daily-return-service';

export const dynamic='force-dynamic';
export const maxDuration=60;
function authenticated(request:Request){
 const token=String(request.headers.get('authorization')||'').replace(/^Bearer\s+/i,'').trim();
 return [process.env.CRON_SECRET,process.env.WA_DAILY_CRON_SECRET]
   .filter((secret):secret is string=>typeof secret==='string'&&secret.length>=20)
   .some(secret=>token.length===secret.length&&timingSafeEqual(Buffer.from(secret),Buffer.from(token)));
}
export async function GET(request:Request){
 if(!authenticated(request))return NextResponse.json({ok:false,error:'Unauthorized'},{status:401});
 const now=new Date();
 const weekday=new Intl.DateTimeFormat('en-US',{timeZone:'America/Sao_Paulo',weekday:'short'}).format(now);
 const hour=Number(new Intl.DateTimeFormat('en-GB',{timeZone:'America/Sao_Paulo',hour:'2-digit',hourCycle:'h23'}).format(now));
 // The scanner is independent of the operator's location/browser.
 // It may verify and persist evidence at any hour. Tenant-specific
 // send_anytime authorization determines whether it can also queue outbound
 // WhatsApp messages outside the default staffed hours.
 const sendingWindow=!['Sat','Sun'].includes(weekday)&&hour>=9&&hour<18;
 const db=await getSupabaseAdmin(),day=brazilToday(now);
 const {data:configs,error}=await db.from('wa_daily_return_settings')
   .select('empresa_id,interval_days,send_anytime').eq('enabled',true).eq('consent_attested',true).limit(25);
 if(error)return NextResponse.json({ok:false,error:'Configuration unavailable'},{status:503});
 const started=Date.now(),maxRuntime=40000;
 let prepared=0,checked=0,lastReason='nothing_due',anySendingWindow=false;
 for(const config of configs||[]){
  if(Date.now()-started>maxRuntime)break;
  if(!sendingWindow && !config.send_anytime){
    // Pre-verify up to three due processes per run, conserving the court
    // request budget. queueOnly=true cannot enqueue or send any message.
    for(let n=0;n<3&&Date.now()-started<35000;n++){
      const result=await processNextDueReturn(config.empresa_id,config.interval_days,true);
      if(!result.processed)break;
      checked++;
      lastReason=String(result.reason||lastReason);
    }
    continue;
  }
  anySendingWindow=true;
  // Deliver previously checked valid notices first, without rescanning.
  const queued=await dispatchPreparedDailyReturns(config.empresa_id,config.interval_days);
  if((queued as any).queued)prepared++;
  lastReason=String(queued.reason||lastReason);
  if(!queued.processed&&Date.now()-started<maxRuntime){
    for(let n=0;n<6&&Date.now()-started<maxRuntime;n++){
      const next=await processNextDueReturn(config.empresa_id,config.interval_days,false);
      if(!next.processed)break;
      checked++;
      if((next as any).queued){prepared++;break;}
      lastReason=String(next.reason||lastReason);
    }
  }
 }
 return NextResponse.json({ok:true,queued:prepared,checked,preparedOnly:!anySendingWindow,reason:lastReason,
   elapsedMs:Date.now()-started},{headers:{'Cache-Control':'private, no-store'}});

}

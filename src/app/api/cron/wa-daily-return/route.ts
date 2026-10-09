import {NextResponse} from 'next/server';
import {timingSafeEqual} from 'node:crypto';
import {getSupabaseAdmin} from '@/lib/server-db';
import {brazilToday} from '@/lib/wa-daily-return-policy';
import {processNextDueReturn} from '@/lib/wa-daily-return-service';

export const dynamic='force-dynamic';
export const maxDuration=60;
function authenticated(request:Request){
 const secret=String(process.env.CRON_SECRET||process.env.WA_MOVEMENT_CRON_SECRET||'');
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
 for(const config of configs||[]){
  const {count,error:countError}=await db.from('wa_daily_return_sends').select('id',{count:'exact',head:true})
    .eq('empresa_id',config.empresa_id).eq('local_day',day).eq('status','sent');
  if(countError||Number(count||0)>=25)continue;
  const result=await processNextDueReturn(config.empresa_id,config.interval_days);
  if((result as any).processed)return NextResponse.json({ok:result.ok,processed:true,
    reason:(result as any).reason||null,sent:(result as any).sent===true},
    {headers:{'Cache-Control':'private, no-store'}});
 }
 return NextResponse.json({ok:true,processed:false,reason:'no_due_cases_or_daily_limit'});
}

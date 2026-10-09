import {timingSafeEqual} from 'node:crypto';
import {NextResponse} from 'next/server';
import {normalizePhone} from '@/lib/wa-daily-return-policy';
import {persistWhatsAppMessage} from '@/lib/whatsapp-persist';
import {processIncomingReturnRequest} from '@/lib/wa-daily-return-service';

export const dynamic='force-dynamic';
export const maxDuration=60;
export async function POST(request:Request){
 const secret=String(process.env.WA_DAILY_WEBHOOK_SECRET||'');
 const got=String(request.headers.get('authorization')||'').replace(/^Bearer\s+/i,'').trim();
 if(secret.length<24||got.length!==secret.length||
    !timingSafeEqual(Buffer.from(secret),Buffer.from(got)))
   return NextResponse.json({ok:false,error:'Unauthorized'},{status:401});
 // This URL may only be attached to the one WA.Auto instance explicitly
 // bound to an enterprise. External payloads must not choose a tenant.
 const empresaId=String(process.env.WA_DAILY_WEBHOOK_EMPRESA_ID||'');
 const configuredInstance=String(process.env.WA_DAILY_WEBHOOK_INSTANCE||'');
 if(!/^[0-9a-f-]{36}$/i.test(empresaId)||!configuredInstance)
   return NextResponse.json({ok:false,error:'Webhook not bound to an instance'},{status:503});
 const data=await request.json().catch(()=>null);
 if(!data||typeof data!=='object'||data.instance!==configuredInstance||data.fromMe!==false)
   return NextResponse.json({ok:true,processed:false,reason:'not_a_customer_message'});
 const phone=normalizePhone(data.phone||data.contactNumber);
 const text=String(data.text||data.message||'').slice(0,1000);
 if(!phone||!text)return NextResponse.json({ok:true,processed:false,reason:'no_text'});
 const stored=await persistWhatsAppMessage({
   contactNumber:phone,messageText:text,fromMe:false,empresaId,
   messageId:String(data.messageId||'wa-auto-'+phone+'-'+Date.now()),
   source:'waauto-inbound',instanceName:configuredInstance,
 });
 if(!stored.ok)return NextResponse.json({ok:false,error:'Incoming history unavailable'},{status:503});
 const result=await processIncomingReturnRequest(empresaId,phone,text);
 return NextResponse.json({ok:true,processed:result.sent===true,reason:result.reason||null},
   {headers:{'Cache-Control':'private, no-store'}});
}

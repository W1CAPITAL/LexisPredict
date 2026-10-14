import 'server-only';
import {getSupabaseAdmin} from '@/lib/server-db';

// Store only an opted-out phone and timestamp. Never persist new chat text.
const STOP=/^(SAIR|STOP|PARE|CANCELAR MENSAGENS|N[AÃ]O ME ENVIE MENSAGENS)[\s.!?]*$/i;
function phoneOf(value:string){
 let v=String(value||'').replace(/\D/g,'');
 if(v.length===10||v.length===11)v='55'+v;
 return /^55\d{10,11}$/.test(v)?v:'';
}
export async function contactOptedOut(tenant:string,value:string){
 const phone=phoneOf(value);
 if(!phone)throw new Error('Telefone inválido');
 const db=await getSupabaseAdmin();
 const {data,error}=await db.from('wa_contact_optouts')
   .select('phone').eq('empresa_id',tenant).eq('phone',phone).maybeSingle();
 if(error)throw new Error('Preferências indisponíveis');
 return !!data;
}
export async function noteInboundPreference(tenant:string,value:string,text:string){
 const phone=phoneOf(value);
 if(!phone)return false;
 if(!STOP.test(String(text||'').trim()))return false;
 const db=await getSupabaseAdmin();
 const {error}=await db.from('wa_contact_optouts')
   .upsert({empresa_id:tenant,phone,opted_out_at:new Date().toISOString()},
     {onConflict:'empresa_id,phone'});
 if(error)throw new Error('Pedido de SAIR não registrado');
 return true;
}
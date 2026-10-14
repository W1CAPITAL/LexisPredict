import {NextResponse} from 'next/server';
import {createHash} from 'node:crypto';
import {getSupabaseAdmin} from '@/lib/server-db';
import {persistWhatsAppMessage} from '@/lib/whatsapp-persist';

export const dynamic='force-dynamic';
export const maxDuration=25;
const noStore={'Cache-Control':'private, no-store'};
function result(body:unknown,status=200){return NextResponse.json(body,{status,headers:noStore});}

/** Called by the local worker only; auth is a 256-bit scoped token, never Supabase service_role. */
export async function POST(req:Request){
  const bearer=String(req.headers.get('authorization')||'').match(/^Bearer ([a-f0-9]{64})$/i);
  if(!bearer)return result({ok:false,error:'Unauthorized'},401);
  const tokenHash=createHash('sha256').update(bearer[1]).digest('hex');
  // Credential shared in a support conversation is compromised: reject without exposing it.
  if (tokenHash === '020dbfb52e14f5c025cbb4882d9ec01ea6a56b3e207ae4e4867c54d090adb6cc') {
    return result({ok:false,error:'Credential revoked'},401);
  }
  const db=await getSupabaseAdmin();
  const {data:bridge,error:authError}=await db.from('wa_local_bridges')
    .select('empresa_id').eq('token_sha256',tokenHash).maybeSingle();
  if(authError||!bridge)return result({ok:false,error:'Unauthorized'},401);
  let body:any;
  try{
    const raw=await req.text();
    if(raw.length>110000)return result({ok:false,error:'Payload too large'},413);
    body=JSON.parse(raw);
    if(!body||typeof body!=='object')throw Error('bad body');
  }catch{return result({ok:false,error:'Invalid JSON'},400);}
  const tenant=bridge.empresa_id as string;
  switch(String(body.type||'')){
    case 'status':{
      const state=['offline','connecting','qr','ready','error'].includes(body.state)?body.state:'error';
      const qr=state==='qr'&&/^data:image\/png;base64,[a-zA-Z0-9+/=]+$/.test(String(body.qr||''))&&String(body.qr||'').length<90000
        ?String(body.qr):null;
      const {error}=await db.from('wa_local_bridges').update({
        state,qr_data_url:qr,phone:/^55\d{10,11}$/.test(String(body.phone||''))?String(body.phone):null,
        last_error:body.error?String(body.error).slice(0,200):null,
        last_seen:new Date().toISOString(),updated_at:new Date().toISOString(),
      }).eq('empresa_id',tenant);
      return result({ok:!error},error?503:200);
    }
    case 'claim':{
      const {data,error}=await db.rpc('wa_local_claim',{p_empresa:tenant});
      if(error)return result({ok:false,error:'Queue unavailable'},503);
      const j=(data||[])[0];
      return result({ok:true,job:j?{id:j.id,to:j.to_phone,body:j.body}:null});
    }
    case 'ack':{
      const id=String(body.id||''),state=String(body.state||'');
      if(!/^[0-9a-f-]{36}$/i.test(id)||!['accepted','delivered','read','failed','uncertain'].includes(state))
        return result({ok:false,error:'Invalid acknowledgement'},400);
      const {data:prior}=await db.from('wa_local_jobs').select('id,status').eq('empresa_id',tenant).eq('id',id).maybeSingle();
      if(!prior)return result({ok:false,error:'Unknown job'},404);
      const transitions:Record<string,string[]>={
        claimed:['accepted','failed','uncertain'],accepted:['delivered','read'],delivered:['read'],
      };
      if(prior.status===state)return result({ok:true});
      if(!(transitions[prior.status]||[]).includes(state))
        return result({ok:false,error:'Invalid state transition'},409);
      const patch:any={status:state,resolved_at:new Date().toISOString(),
        last_error:body.error?String(body.error).slice(0,200):null};
      if(typeof body.messageId==='string')patch.provider_message_id=body.messageId.slice(0,160);
      const {error}=await db.from('wa_local_jobs').update(patch)
        .eq('empresa_id',tenant).eq('id',id).eq('status',prior.status);
      return result({ok:!error},error?503:200);
    }
    case 'message':{
      const from=body.fromMe===true,text=String(body.text||'').trim().slice(0,8000);
      let phone=String(body.phone||'').replace(/\D/g,'');
      if(phone.length===10||phone.length===11)phone='55'+phone;
      const id=String(body.messageId||'').slice(0,160);
      if(!/^55\d{10,11}$/.test(phone)||!text||!id)return result({ok:false,error:'Invalid message'},400);
      const {data:existing,error:lookupError}=await db.from('whatsapp_messages').select('id')
        .eq('empresa_id',tenant).eq('message_id',id).limit(1).maybeSingle();
      if(lookupError)return result({ok:false,error:'History lookup unavailable'},503);
      if(existing)return result({ok:true,duplicate:true});
      const stored=await persistWhatsAppMessage({empresaId:tenant,contactNumber:phone,
        messageText:text,fromMe:from,source:'lexis-local-wa',messageId:id,raw:{via:'wa-local',type:'text'}});
      return result({ok:stored.ok,error:stored.ok?undefined:'History write failed'},stored.ok?200:503);
    }
  }
  return result({ok:false,error:'Unknown operation'},400);
}

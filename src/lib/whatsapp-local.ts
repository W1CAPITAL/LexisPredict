import 'server-only';
import {createHash,randomBytes} from 'node:crypto';
import {getSupabaseAdmin,getUserContext} from '@/lib/server-db';
import {resolveWaAutoPermissions} from '@/lib/wa-auto-permissions';
import {contactOptedOut} from '@/lib/wa-contact-privacy';

export function normalizedPhone(raw:string):string {
  let n=String(raw||'').replace(/\D/g,'');
  if(n.length===10||n.length===11)n='55'+n;
  return /^55\d{10,11}$/.test(n)?n:'';
}
export async function actor(manager=false){
  const ctx=await getUserContext();
  if(!ctx.auth_id||!ctx.empresa_id||ctx.isViewer)throw new Error('Sessão sem acesso ao WhatsApp desta empresa.');
  if(manager&&!resolveWaAutoPermissions({cargo:ctx.cargo}).canManage)
    throw new Error('Somente Administrador, Supervisor ou Superadmin pode configurar a conexão.');
  return ctx as typeof ctx & {auth_id:string;empresa_id:string};
}
export async function bridgeStatus(tenant:string,canSeeQr=false){
  const db=await getSupabaseAdmin();
  const {data,error}=await db.from('wa_local_bridges')
    .select('state,qr_data_url,phone,last_seen,last_error,created_at').eq('empresa_id',tenant).maybeSingle();
  if(error)throw new Error('Não foi possível consultar a ponte WhatsApp: '+error.message);
  const age=data?.last_seen?Date.now()-Date.parse(data.last_seen):Infinity;
  const online=!!data&&Number.isFinite(age)&&age>=0&&age<45000;
  const qrStored=data?.state==='qr'
    &&/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(String(data.qr_data_url||''))
    &&String(data.qr_data_url||'').length<90000;
  // A imagem pode ser mostrada para recuperar a interface, mas não pode ser
  // apresentada como QR válido sem um heartbeat recente do worker.
  // Show the last image for diagnostics even if the service is offline.
  // qrFresh stays false, so the UI warns that the QR may be expired.
  const qrRecent=!!qrStored;
  return {
    provisioned:!!data,online,connected:online&&data?.state==='ready',
    state:online?data?.state||'offline':'offline',
    connectionState:data?.state||'offline',
    qr:canSeeQr&&qrRecent?String(data.qr_data_url):null,
    qrFresh:online&&!!qrRecent,
    qrStale:!!qrStored&&!online,
    phone:online?data?.phone||null:null,
    error:data?.last_error||null,
    lastSeen:data?.last_seen||null,
  };
}
export async function provisionBridge(){
  const ctx=await actor(true),db=await getSupabaseAdmin();
  const token=randomBytes(32).toString('hex');
  const tokenHash=createHash('sha256').update(token).digest('hex');
  const {error}=await db.from('wa_local_bridges').upsert({
    empresa_id:ctx.empresa_id,owner_auth_id:ctx.auth_id,token_sha256:tokenHash,
    state:'offline',qr_data_url:null,phone:null,last_error:null,last_seen:null,
    updated_at:new Date().toISOString(),
  },{onConflict:'empresa_id'});
  if(error)throw new Error('Não foi possível provisionar a conexão: '+error.message);
  return {token,baseUrl:'https://lexispredict.vercel.app'};
}
export async function enqueueLocalMessage(phone:string,message:string){
  const ctx=await actor(),n=normalizedPhone(phone),body=String(message||'').trim();
  if(!n)throw new Error('Número inválido: informe DDD e telefone brasileiro.');
  if(!body||body.length>4000)throw new Error('Mensagem deve ter entre 1 e 4.000 caracteres.');
  const state=await bridgeStatus(ctx.empresa_id);
  if(!state.connected)throw new Error('WA.Auto desconectado. Aguarde a conexão e escaneie o QR Code no CRM.');
  const db=await getSupabaseAdmin();
  if(await contactOptedOut(ctx.empresa_id,n))
    throw new Error('O contato solicitou SAIR; envio bloqueado.');
  const {data,error}=await db.from('wa_local_jobs').insert({
    empresa_id:ctx.empresa_id,created_by:ctx.auth_id,to_phone:n,body,status:'pending',
  }).select('id').single();
  if(error||!data)throw new Error('Não foi possível registrar o envio na fila.');
  return {jobId:String(data.id),phone:n};
}
export async function listLocalChats(opts?:{onlyGroups?:boolean;limit?:number}){
  const ctx=await actor();
  if(opts?.onlyGroups)return [] as {jid:string;name:string;isGroup:boolean;lastMessage:string}[];
  const db=await getSupabaseAdmin(),lim=Math.min(1000,Math.max(100,Number(opts?.limit||300)*3));
  const {data,error}=await db.from('whatsapp_messages')
    .select('contact_number,phone,contact_name,message_text,body,timestamp,created_at')
    .eq('empresa_id',ctx.empresa_id).order('created_at',{ascending:false}).limit(lim);
  if(error)throw new Error('Não foi possível consultar conversas salvas.');
  const seen=new Map<string,{jid:string;name:string;isGroup:boolean;lastMessage:string}>();
  for(const row of data||[]){
    const phone=normalizedPhone(String(row.contact_number||row.phone||''));
    if(!phone||seen.has(phone))continue;
    seen.set(phone,{jid:phone+'@s.whatsapp.net',name:String(row.contact_name||phone),
      isGroup:false,lastMessage:String(row.message_text||row.body||'').slice(0,150)});
    if(seen.size>=Math.min(300,Math.max(1,Number(opts?.limit||100))))break;
  }
  return [...seen.values()];
}
export async function localChat(jid:string){
  const ctx=await actor(),n=normalizedPhone(String(jid).split('@')[0]);
  if(!n)throw new Error('Contato inválido.');
  const db=await getSupabaseAdmin();
  const {data,error}=await db.from('whatsapp_messages')
    .select('id,message_id,message_text,body,from_me,timestamp,created_at,source')
    .eq('empresa_id',ctx.empresa_id).or('contact_number.eq.'+n+',phone.eq.'+n)
    .order('created_at',{ascending:false}).limit(250);
  if(error)throw new Error('Não foi possível carregar o histórico do contato.');
  return (data||[]).reverse().map(m=>({
    id:String(m.message_id||m.id),direction:m.from_me?'out' as const:'in' as const,
    body:String(m.message_text||m.body||''),at:String(m.timestamp||m.created_at),source:m.source||'Supabase',
  }));
}

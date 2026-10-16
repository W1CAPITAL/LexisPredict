'use server';
import {actor,bridgeStatus,listLocalChats,localChat} from '@/lib/whatsapp-local';
import {getSupabaseAdmin} from '@/lib/server-db';

export async function waLocalStatusAction(){
  try{
    // The old WA.Auto host is suspended: never poll it just to get the
    // linked device status. Supabase bridge heartbeat is authoritative.
    const user=await actor();
    const manage=(await import('@/lib/wa-auto-permissions')).resolveWaAutoPermissions({cargo:user.cargo}).canManage;
    return {ok:true as const,...await bridgeStatus(user.empresa_id,manage)};
  }catch(e:any){return {ok:false as const,error:e?.message||'Falha na conexão'};}
}
/** Request a fresh QR from the currently running linked-device worker.
 * Only an authorized manager can request it; no backup or credentials are cleared.
 */
export async function waLocalRequestFreshQrAction(){
  try{
    const ctx=await actor(true);
    const db=await getSupabaseAdmin();
    const {data,error}=await db.from('wa_local_bridges')
      .select('state,last_seen,qr_refresh_requested_at')
      .eq('empresa_id',ctx.empresa_id).maybeSingle();
    if(error||!data)return {ok:false as const,error:'Conexão WhatsApp ainda não configurada.'};
    const lastSeen=Date.parse(String(data.last_seen||''));
    if(!Number.isFinite(lastSeen)||Date.now()-lastSeen>45000)
      return {ok:false as const,error:'O serviço do WhatsApp está offline. O QR não pode ser renovado sem o worker ativo.'};
    if(data.state==='ready')return {ok:true as const,alreadyConnected:true};
    const previous=Date.parse(String(data.qr_refresh_requested_at||''));
    if(Number.isFinite(previous)&&Date.now()-previous<45000)
      return {ok:true as const,pending:true};
    const {error:writeError}=await db.from('wa_local_bridges')
      .update({qr_refresh_requested_at:new Date().toISOString()})
      .eq('empresa_id',ctx.empresa_id);
    if(writeError)return {ok:false as const,error:'Falha ao registrar pedido de novo QR.'};
    return {ok:true as const,pending:true};
  }catch(error){
    return {ok:false as const,error:error instanceof Error?error.message:'Falha ao renovar o QR.'};
  }
}
export async function waLocalProvisionAction(){
  // The user has declined local installation; do not generate new unusable credentials.
  return {ok:false as const,error:'Ativação local desabilitada. Não existe hospedagem de sessão WhatsApp validada.'};
}
export async function waLocalChatsAction(opts?:{onlyGroups?:boolean;limit?:number}){
  try{return {ok:true as const,chats:await listLocalChats(opts)};}
  catch(e:any){return {ok:false as const,chats:[],error:e?.message||'Falha no histórico'};}
}
export async function waLocalChatAction(jid:string){
  try{return {ok:true as const,messages:await localChat(jid)};}
  catch(e:any){return {ok:false as const,messages:[],error:e?.message||'Falha no histórico'};}
}

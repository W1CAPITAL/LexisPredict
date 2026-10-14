'use server';
import {actor,bridgeStatus,listLocalChats,localChat} from '@/lib/whatsapp-local';

export async function waLocalStatusAction(){
  try{
    // The old WA.Auto host is suspended: never poll it just to get the
    // linked device status. Supabase bridge heartbeat is authoritative.
    const user=await actor();
    const manage=(await import('@/lib/wa-auto-permissions')).resolveWaAutoPermissions({cargo:user.cargo}).canManage;
    return {ok:true as const,...await bridgeStatus(user.empresa_id,manage)};
  }catch(e:any){return {ok:false as const,error:e?.message||'Falha na conexão'};}
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

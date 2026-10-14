'use server';
import {actor,bridgeStatus,provisionBridge,listLocalChats,localChat} from '@/lib/whatsapp-local';

export async function waLocalStatusAction(){
  try{const user=await actor(),manage=(await import('@/lib/wa-auto-permissions')).resolveWaAutoPermissions({cargo:user.cargo}).canManage;
    return {ok:true as const,...await bridgeStatus(user.empresa_id,manage)};
  }catch(e:any){return {ok:false as const,error:e?.message||'Falha na conexão'};}
}
export async function waLocalProvisionAction(){
  try{return {ok:true as const,...await provisionBridge()};}
  catch(e:any){return {ok:false as const,error:e?.message||'Não foi possível configurar'};}
}
export async function waLocalChatsAction(opts?:{onlyGroups?:boolean;limit?:number}){
  try{return {ok:true as const,chats:await listLocalChats(opts)};}
  catch(e:any){return {ok:false as const,chats:[],error:e?.message||'Falha no histórico'};}
}
export async function waLocalChatAction(jid:string){
  try{return {ok:true as const,messages:await localChat(jid)};}
  catch(e:any){return {ok:false as const,messages:[],error:e?.message||'Falha no histórico'};}
}

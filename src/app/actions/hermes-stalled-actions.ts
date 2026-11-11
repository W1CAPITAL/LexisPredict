'use server';
import {getUserContext} from '@/lib/server-db';
import {getHermesStalledSummaries} from '@/lib/hermes-company-service';

/** Projeção privada de um monitor já executado no servidor por cron.
 * Nenhum scan disparado do navegador; não modifica processos nem envia contato.
 */
export async function getHermesStalledForParadosAction(){
 try{
  const ctx=await getUserContext();
  if(!ctx?.auth_id||!ctx?.empresa_id)return {
   ok:false as const,items:[],error:'Sessão não autorizada.'
  };
  const items=await getHermesStalledSummaries(String(ctx.empresa_id));
  return {ok:true as const,items};
 }catch{
  return {ok:false as const,items:[],error:'Não foi possível carregar a investigação automática do Hermes.'};
 }
}

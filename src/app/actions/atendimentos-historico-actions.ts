'use server';
import { getUserContext } from "@/lib/server-db";
import { getHistoricoAtendimentosEmpresa,emptyHistorico } from "@/lib/historico-atendimentos";
import type { PeriodoRelatorio } from "@/lib/atendimento-semana";
export async function getAtendimentosHistoricoAction(periodo:PeriodoRelatorio="esta_semana"){
 try{
  const ctx=await getUserContext();
  if(!ctx.empresa_id||!ctx.auth_id)return {ok:false,data:emptyHistorico(periodo),error:"Sessão expirada"};
  return {ok:true,data:await getHistoricoAtendimentosEmpresa(String(ctx.empresa_id),periodo)};
 }catch(e){console.error("[historico-atendimentos]",e);return {ok:false,data:emptyHistorico(periodo),error:e instanceof Error?e.message:"Falha no histórico"};}
}

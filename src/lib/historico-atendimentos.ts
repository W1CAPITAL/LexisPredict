import { getSupabaseAdmin } from "@/lib/server-db";
import type { PeriodoRelatorio } from "@/lib/atendimento-semana";

export type AtendimentosHistorico = {
 processos:number; eventos:number; tecnicoEventos:number;
 edicoes:{processos:number;eventos:number;hoje:number};
 porUsuario:Array<{userId:string;nome:string;processos:number;eventos:number}>;
 dias:Array<{ymd:string;day:string;atendimentos:number}>;
 atualizadoEm:string; periodo:PeriodoRelatorio;
};
export function emptyHistorico(periodo:PeriodoRelatorio="esta_semana"):AtendimentosHistorico{
 return {processos:0,eventos:0,tecnicoEventos:0,edicoes:{processos:0,eventos:0,hoje:0},porUsuario:[],dias:[],atualizadoEm:"",periodo};
}
/** Fonte única e rápida para /processos, Dashboard, /report e Supervisão.
 * Agregação no Postgres; não baixa processos nem todos os logs no browser.
 * O RPC só é executado via service_role após verificação da sessão e empresa.
 */
export async function getHistoricoAtendimentosEmpresa(
 empresaId:string,periodo:PeriodoRelatorio="esta_semana"
):Promise<AtendimentosHistorico>{
 const db=await getSupabaseAdmin();
 const {data,error}=await db.rpc("lexis_atividade_kpis_periodo",{p_empresa:empresaId,p_periodo:periodo});
 if(error)throw new Error("Falha na consulta do histórico: "+error.message);
 if(!data||typeof data!=="object"||!Array.isArray(data.dias))throw new Error("Histórico inválido");
 return data as AtendimentosHistorico;
}
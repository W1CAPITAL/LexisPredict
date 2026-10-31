'use server';
import { getReportIdentity } from '@/lib/report/report-identity';
import { getUserContext } from "@/lib/server-db";
import { getResumoAnalisesDaEmpresa } from "@/lib/analises-internas";
import { periodBounds, type PeriodoRelatorio } from "@/lib/atendimento-semana";

// Indicador de produtividade INTERNA: não altera status de cliente atendido por telefone/WhatsApp.
export async function getAnalisesInternasResumoAction(periodo:PeriodoRelatorio="esta_semana") {
  try {
    const ctx=await getUserContext();
    if(!ctx.empresa_id || !ctx.auth_id) return {success:false,error:"Sessão expirada."};
    const dates=periodBounds(periodo,new Date());
    const toYmd=(dt:Date)=>[dt.getFullYear(),String(dt.getMonth()+1).padStart(2,"0"),String(dt.getDate()).padStart(2,"0")].join("-");
    const resumo=await getResumoAnalisesDaEmpresa(String(ctx.empresa_id),toYmd(dates.start),toYmd(dates.end),String(ctx.auth_id));
    const identity=await getReportIdentity();
    return {success:true,resumo:{...resumo,empresaNome:identity.company}};
  } catch(e) {
    return {success:false,error:e instanceof Error?e.message:"Falha ao consultar análises."};
  }
}

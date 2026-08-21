"use server";

/**
 * Carrega métricas de atendimento da empresa INTEIRA com colunas mínimas.
 * Não substitui a lista da Fila — só corrige KPI/ranking.
 */

import { aggregateKpiAtendimento, type KpiAtendimentoServer } from "@/lib/kpi-atendimento-server";

const COLS =
  "id, protocolo_ref, empresa_id, created_by, atendido_por, ultimo_retorno, status, datajud_encerrado_tribunal, dados";

export async function fetchKpiAtendimentoEmpresaAction(): Promise<KpiAtendimentoServer> {
  try {
    const { getUserContext, getSupabaseAdmin, supabase } = await import("@/lib/server-db");
    const ctx = await getUserContext();
    if (!ctx?.empresa_id) {
      return emptyKpi();
    }

    let client = await getSupabaseAdmin();
    if (!client) client = supabase as any;
    if (!client) return emptyKpi();

    const empresaId = ctx.empresa_id;
    const pageSize = 1000;
    let offset = 0;
    let all: any[] = [];
    const HARD_MAX = 8000;

    while (all.length < HARD_MAX) {
      const { data, error } = await client
        .from("processos")
        .select(COLS)
        .eq("empresa_id", empresaId)
        .order("created_at", { ascending: false })
        .range(offset, offset + pageSize - 1);

      if (error) {
        console.error("[fetchKpiAtendimentoEmpresaAction]", error.message);
        break;
      }
      const chunk = data || [];
      all = all.concat(chunk);
      if (chunk.length < pageSize) break;
      offset += pageSize;
    }

    return aggregateKpiAtendimento(all, { rankingLimit: 5 });
  } catch (e: any) {
    console.error("[fetchKpiAtendimentoEmpresaAction]", e?.message);
    return emptyKpi();
  }
}

function emptyKpi(): KpiAtendimentoServer {
  return {
    totalAtivos: 0,
    totalLinhas: 0,
    atendidosSemana: 0,
    atendidosHoje: 0,
    semanaLabel: "",
    ranking: [],
    porUsuario: {},
  };
}

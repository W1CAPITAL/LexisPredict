"use server";

import { isCasoEncerrado, isBaixaTribunal } from "@/lib/status-encerrado";
import {isCasoVencido} from "@/lib/vencimentos";
import { resolveSituacaoFromRow, resolveStatusManualFromRow } from "@/lib/resolve-situacao";

export type ProcessosEmpresaKpis = {
  ok: boolean;
  total: number;
  ativos: number;
  encerradosCarteira: number;
  baixasTribunal: number;
  vencidos: number;
  error?: string;
};

function rowAsCase(row: any) {
  const d = row?.dados && typeof row.dados === "object" ? row.dados : {};
  const situacao = resolveSituacaoFromRow(row, d);
  const statusManual = resolveStatusManualFromRow(row, d, situacao);
  return {
    status: row?.status ?? d.status ?? null,
    proximo_retorno: row?.proximo_retorno ?? null,
    ultimo_retorno: row?.ultimo_retorno ?? null,
    situacao,
    statusManual,
    status_interno: row?.status_interno ?? situacao,
    via_scan_auto_encerrar: d.via_scan_auto_encerrar ?? row?.via_scan_auto_encerrar,
    operacao_sistema: d.operacao_sistema,
    datajud_encerrado_tribunal: row?.datajud_encerrado_tribunal,
    em_cumprimento_sentenca: row?.em_cumprimento_sentenca ?? d.em_cumprimento_sentenca,
    cumprimento_pendente_necessario:
      row?.cumprimento_pendente_necessario ?? d.cumprimento_pendente_necessario,
    evento_resumo: d.evento_resumo,
    datajud_encerrado_motivo: row?.datajud_encerrado_motivo ?? d.datajud_encerrado_motivo,
    djen_ultimo_resumo: row?.djen_ultimo_resumo ?? d.djen_ultimo_resumo,
    dados: d,
  };
}

export async function fetchProcessosEmpresaKpisAction(_companyView = true): Promise<ProcessosEmpresaKpis> {
  try {
    const { getUserContext, getSupabaseAdmin } = await import("@/lib/server-db");
    const ctx = await getUserContext();
    if (!ctx?.empresa_id || !ctx?.auth_id) {
      return {
        ok: false,
        total: 0,
        ativos: 0,
        encerradosCarteira: 0,
        baixasTribunal: 0,
        vencidos: 0,
        error: "sem empresa",
      };
    }
    const admin = await getSupabaseAdmin();
    if (!admin) {
      return {
        ok: false,
        total: 0,
        ativos: 0,
        encerradosCarteira: 0,
        baixasTribunal: 0,
        vencidos: 0,
        error: "admin",
      };
    }

    const empresaId = String(ctx.empresa_id);
    // KPIs são agregados da empresa inteira para todos os cargos.
    // O tenant vem exclusivamente do contexto autenticado; a lista detalhada
    // continua obedecendo ao escopo individual nas rotas próprias.
    const pageSize = 1000;
    let offset = 0;
    let total = 0;
    let ativos = 0;
    let encerradosCarteira = 0;
    let baixasTribunal = 0;
    let vencidos = 0;

    for (;;) {
      const query = admin
        .from("processos")
        .select(
          "id, status, status_interno, proximo_retorno, ultimo_retorno, datajud_encerrado_tribunal, datajud_encerrado_motivo, em_cumprimento_sentenca, cumprimento_pendente_necessario, djen_ultimo_resumo, dados"
        )
        .eq("empresa_id", empresaId)
        .order("id", { ascending: true })
        .range(offset, offset + pageSize - 1);



      const { data, error } = await query;

      if (error) {
        console.error("[processos-kpis] consulta incompleta", error.message);
        return { ok:false,total:0,ativos:0,encerradosCarteira:0,baixasTribunal:0,vencidos:0,
          error:"Não foi possível carregar todos os indicadores. Tente novamente." };
      }
      const chunk = data || [];
      for (const row of chunk) {
        total++;
        const c = rowAsCase(row);
        const enc = isCasoEncerrado(c);
        if (enc) {
          encerradosCarteira++;
        } else {
          ativos++;
          // Mesmo contrato da RPC e da /vencidos: retorno agendado vencido,
          // sem atendimento posterior. Um status manual não prova atraso.
          if (isCasoVencido(c)) vencidos++;
        }
        if (isBaixaTribunal(c)) baixasTribunal++;
      }
      if (chunk.length < pageSize) break;
      offset += pageSize;
      if (offset > 30000) {
        return { ok:false,total:0,ativos:0,encerradosCarteira:0,baixasTribunal:0,vencidos:0,
          error:"Limite de paginação alcançado. Indicadores indisponíveis." };
      }
    }

    // Invariante: ativos + encerrados = total
    if (ativos + encerradosCarteira !== total && total > 0) {
      ativos = Math.max(0, total - encerradosCarteira);
    }

    return {
      ok: true,
      total,
      ativos,
      encerradosCarteira,
      baixasTribunal,
      vencidos,
    };
  } catch (e: any) {
    return {
      ok: false,
      total: 0,
      ativos: 0,
      encerradosCarteira: 0,
      baixasTribunal: 0,
      vencidos: 0,
      error: e?.message,
    };
  }
}

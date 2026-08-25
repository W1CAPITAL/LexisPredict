"use server";

/**
 * KPIs de /processos alinhados ao Dashboard (carteira da empresa).
 * Não usa a lista parcial da tabela.
 */

import { isCasoEncerrado, isBaixaTribunal } from "@/lib/status-encerrado";

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
  return {
    status: row?.status ?? d.status ?? null,
    situacao: d.situacao ?? row?.status_interno ?? null,
    statusManual: d.statusManual ?? null,
    status_interno: row?.status_interno ?? d.status_interno ?? null,
    via_scan_auto_encerrar: d.via_scan_auto_encerrar,
    operacao_sistema: d.operacao_sistema,
    datajud_encerrado_tribunal: row?.datajud_encerrado_tribunal,
    em_cumprimento_sentenca: row?.em_cumprimento_sentenca ?? d.em_cumprimento_sentenca,
    dados: d,
  };
}

export async function fetchProcessosEmpresaKpisAction(): Promise<ProcessosEmpresaKpis> {
  try {
    const { getUserContext, getSupabaseAdmin } = await import("@/lib/server-db");
    const ctx = await getUserContext();
    if (!ctx?.empresa_id) {
      return { ok: false, total: 0, ativos: 0, encerradosCarteira: 0, baixasTribunal: 0, vencidos: 0, error: "sem empresa" };
    }
    const admin = await getSupabaseAdmin();
    if (!admin) {
      return { ok: false, total: 0, ativos: 0, encerradosCarteira: 0, baixasTribunal: 0, vencidos: 0, error: "admin" };
    }

    const empresaId = String(ctx.empresa_id);
    const pageSize = 1000;
    let offset = 0;
    let total = 0;
    let ativos = 0;
    let encerradosCarteira = 0;
    let baixasTribunal = 0;
    let vencidos = 0;

    for (;;) {
      const { data, error } = await admin
        .from("processos")
        .select(
          "status, status_interno, datajud_encerrado_tribunal, em_cumprimento_sentenca, dados"
        )
        .eq("empresa_id", empresaId)
        .range(offset, offset + pageSize - 1);

      if (error) {
        console.error("[processos-kpis]", error.message);
        break;
      }
      const chunk = data || [];
      for (const row of chunk) {
        total++;
        const c = rowAsCase(row);
        const enc = isCasoEncerrado(c);
        if (enc) encerradosCarteira++;
        else {
          ativos++;
          const st = String(c.status || "").trim();
          if (st === "Vencido" || st === "Caso Crítico") vencidos++;
        }
        if (isBaixaTribunal(c)) baixasTribunal++;
      }
      if (chunk.length < pageSize) break;
      offset += pageSize;
      if (offset > 30000) break;
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

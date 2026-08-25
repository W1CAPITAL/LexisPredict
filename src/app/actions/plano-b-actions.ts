"use server";

/**
 * Plano B — export pontual do Supabase + leitura de Sheets/CSV.
 * Nunca grava de volta no Supabase automaticamente.
 * Export só roda quando o usuário pedir (não no boot do app).
 */

import { fetchPlanoBFromUrl, planoBToCsv, type PlanoBRow } from "@/lib/plano-b-sheets";

export async function loadPlanoBFromSheetsAction(url: string): Promise<{
  success: boolean;
  rows: PlanoBRow[];
  error?: string;
  count?: number;
}> {
  const r = await fetchPlanoBFromUrl(url);
  if (!r.ok) return { success: false, rows: [], error: r.error };
  return { success: true, rows: r.rows, count: r.rows.length };
}

/**
 * Snapshot opcional do Supabase → CSV (uma vez, paginado).
 * Use só quando ainda houver cota e quiser migrar a base para Sheets.
 * Não ativa Plano B sozinho.
 */
export async function exportCarteiraSnapshotCsvAction(opts?: {
  maxRows?: number;
}): Promise<{
  success: boolean;
  csv?: string;
  count?: number;
  error?: string;
}> {
  try {
    const { getUserContext, getSupabaseAdmin } = await import("@/lib/server-db");
    const ctx = await getUserContext();
    if (!ctx.empresa_id) return { success: false, error: "Sem sessão" };

    const admin = await getSupabaseAdmin();
    const maxRows = Math.min(Math.max(opts?.maxRows ?? 5000, 100), 8000);
    const pageSize = 500;
    const all: PlanoBRow[] = [];
    let offset = 0;

    while (all.length < maxRows) {
      const { data, error } = await admin
        .from("processos")
        .select(
          "protocolo_ref, status, status_interno, ultimo_retorno, proximo_retorno, created_by, dados"
        )
        .eq("empresa_id", ctx.empresa_id)
        .order("id", { ascending: true })
        .range(offset, offset + pageSize - 1);

      if (error) return { success: false, error: error.message };
      if (!data?.length) break;

      for (const row of data) {
        const d = row.dados && typeof row.dados === "object" ? row.dados : {};
        all.push({
          protocolo: String(row.protocolo_ref || d.protocolo || ""),
          cliente: String(d.cliente || d.CLIENTE || ""),
          advogado: String(d.advogado || d.ADVOGADO || ""),
          escritorio: String(d.escritorio || d.ESCRITORIO || ""),
          tribunal: String(d.tribunal || d.TRIBUNAL || ""),
          status: String(row.status || d.status || ""),
          situacao: String(d.situacao || row.status_interno || ""),
          ultimoRetorno: String(row.ultimo_retorno || d.ultimoRetorno || ""),
          proximoRetorno: String(row.proximo_retorno || d.proximoRetorno || ""),
          criado_por: String(row.created_by || ""),
          observacoes: String(d.observacoes || row.observacoes || ""),
          raw: {},
        });
        if (all.length >= maxRows) break;
      }
      offset += pageSize;
      if (data.length < pageSize) break;
    }

    const filtered = all.filter((r) => r.protocolo);
    return {
      success: true,
      csv: planoBToCsv(filtered),
      count: filtered.length,
    };
  } catch (e: any) {
    return { success: false, error: e?.message || String(e) };
  }
}

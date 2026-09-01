"use server";

import { getUserContext } from "@/lib/server-db";
import { getHybridMode, hybridEnabled, hybridMirrorPostgres, hybridSkipScanAudit } from "@/lib/hybrid/policy";
import {
  sheetsListProcessos,
  sheetsWriteRows,
  sheetsPing,
  sheetsWebhookConfigured,
  type SheetsWriteRow,
} from "@/lib/hybrid/sheets-server";

export async function hybridStatusAction() {
  const mode = getHybridMode();
  const configured = sheetsWebhookConfigured();
  let ping: { ok: boolean; error?: string; json?: any } = { ok: false, error: "não testado" };
  if (configured) ping = await sheetsPing();
  return {
    mode,
    enabled: hybridEnabled(),
    webhookConfigured: configured,
    mirrorPostgres: hybridMirrorPostgres(),
    skipScanAudit: hybridSkipScanAudit(),
    ping,
    spreadsheetHint: "1qbuJee6DCv0bh9XGvnBDPltc0Ziphdn2yx11QKOnchc",
  };
}

export async function hybridPullCarteiraAction(opts?: { limit?: number }) {
  const ctx = await getUserContext();
  if (!ctx.empresa_id) return { success: false, rows: [], error: "Sem sessão Supabase" };
  if (!hybridEnabled()) return { success: false, rows: [], error: "Hybrid desligado (LEXIS_HYBRID_MODE)" };
  if (!sheetsWebhookConfigured()) return { success: false, rows: [], error: "Webhook não configurado" };
  const list = await sheetsListProcessos({
    empresaId: ctx.empresa_id,
    limit: opts?.limit ?? 5000,
  });
  if (!list.ok) return { success: false, rows: [], error: list.error };
  return { success: true, rows: list.rows, count: list.rows.length, source: "sheets" };
}

export async function hybridPushScanBatchAction(
  items: Array<{
    protocolo: string;
    ultimoMovimento?: string;
    ultimoNome?: string;
    djenResumo?: string;
    datajudEncerrado?: boolean;
    proximoRetorno?: string;
    ultimoRetorno?: string;
  }>
) {
  const ctx = await getUserContext();
  if (!ctx.empresa_id) return { success: false, updated: 0, error: "Sem sessão" };
  if (!hybridEnabled()) return { success: false, updated: 0, error: "Hybrid desligado" };
  const rows: SheetsWriteRow[] = (items || []).filter((i) => i.protocolo).map((i) => ({
    protocolo: i.protocolo,
    ultimo_movimento: [i.ultimoNome, i.ultimoMovimento].filter(Boolean).join(" · ") || undefined,
    DJEN_Resumo: i.djenResumo,
    DatajudEncerrado: i.datajudEncerrado,
    UltimoRetorno: i.ultimoRetorno,
    ProximoRetorno: i.proximoRetorno,
  }));
  if (!rows.length) return { success: true, updated: 0 };
  const w = await sheetsWriteRows(rows);
  if (!w.ok) return { success: false, updated: 0, error: w.error };
  return { success: true, updated: w.updated ?? rows.length };
}

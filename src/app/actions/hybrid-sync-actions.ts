"use server";

import { getUserContext, getSupabaseAdmin } from "@/lib/server-db";
import { getHybridMode, hybridEnabled, hybridMirrorPostgres, hybridSkipScanAudit } from "@/lib/hybrid/policy";
import { sheetsListProcessos, sheetsWriteRows, sheetsPing, sheetsWebhookConfigured, type SheetsWriteRow } from "@/lib/hybrid/sheets-server";

function str(v: unknown): string { return v == null ? "" : String(v).trim(); }

function rowFromProcesso(r: any, empresaId: string): SheetsWriteRow {
  const d = r?.dados && typeof r.dados === "object" ? r.dados : {};
  const protocolo = str(r?.protocolo_ref || d.protocolo || d.PROTOCOLO || d.cnj);
  return {
    protocolo,
    Protocolo: protocolo,
    Cliente: str(d.cliente || d.CLIENTE || d.nome_cliente || r?.cliente),
    Status: str(r?.status || d.status || d.situacao),
    Situacao: str(r?.status_interno || d.situacao || d.SITUACAO),
    UltimoRetorno: str(r?.ultimo_retorno || d.ultimoRetorno || d.ultimo_retorno),
    ProximoRetorno: str(r?.proximo_retorno || d.proximoRetorno || d.proximo_retorno || d.PROXIMO_RETORNO),
    Advogado: str(d.advogado || d.ADVOGADO),
    Telefone: str(d.telefone || d.TELEFONE || d.celular),
    CreatedBy: str(r?.created_by || d.created_by),
    Responsavel: str(r?.created_by || d.created_by || d.responsavel),
    AtendidoPor: str(r?.atendido_por || d.atendido_por),
    Observacao: str(r?.observacoes || d.observacao || d.observacoes),
    EmpresaId: str(r?.empresa_id || empresaId),
    Tribunal: str(d.tribunal || d.TRIBUNAL),
    ultimo_movimento: str(r?.datajud_ultimo_nome || d.datajud_ultimo_nome || r?.datajud_ultimo_movimento),
    DJEN_Resumo: str(r?.djen_ultimo_resumo || d.djen_ultimo_resumo).slice(0, 500),
    DatajudEncerrado: !!(r?.datajud_encerrado_tribunal || d.datajud_encerrado_tribunal),
    Cumprimento: str(d.em_cumprimento_sentenca || r?.em_cumprimento_sentenca),
    updated_at: str(r?.updated_at || new Date().toISOString()),
  };
}

/** Health barato: somente ping. Não lê 2.630+ linhas da planilha. */
export async function hybridStatusAction() {
  const mode = getHybridMode();
  const configured = sheetsWebhookConfigured();
  const ping = configured ? await sheetsPing() : { ok: false, error: "Webhook não configurado" };
  return {
    mode,
    enabled: hybridEnabled(),
    webhookConfigured: configured,
    mirrorPostgres: hybridMirrorPostgres(),
    skipScanAudit: hybridSkipScanAudit(),
    ping,
    sheetsCount: null,
    synced: hybridEnabled() && configured && !!ping.ok,
    syncLabel: !hybridEnabled()
      ? "Híbrido desligado"
      : !configured
        ? "Webhook não configurado"
        : !ping.ok
          ? `Sheets indisponível: ${ping.error || "?"}`
          : "Planilha disponível · espelho incremental ativo",
    carteiraSource: "supabase" as const,
    spreadsheetHint: "1qbuJee6DCv0bh9XGvnBDPltc0Ziphdn2yx11QKOnchc",
  };
}

/** Pull é explícito/manual; nunca é executado como efeito colateral do boot. */
export async function hybridPullCarteiraAction(opts?: { limit?: number }) {
  const ctx = await getUserContext();
  if (!ctx.empresa_id) return { success: false, rows: [], error: "Sem sessão Supabase" };
  if (!sheetsWebhookConfigured()) return { success: false, rows: [], error: "Webhook não configurado" };
  const list = await sheetsListProcessos({ empresaId: ctx.empresa_id, limit: Math.min(opts?.limit ?? 5000, 8000) });
  if (!list.ok) return { success: false, rows: [], error: list.error };
  return { success: true, rows: list.rows, count: list.rows.length, source: "sheets" as const };
}

/** Seed é estritamente manual. Uma única chamada pode levar milhares de linhas ao Apps Script otimizado. */
export async function hybridSeedSheetsFromSupabaseAction(opts?: { maxRows?: number }) {
  const ctx = await getUserContext();
  if (!ctx.empresa_id || !ctx.auth_id) return { success: false, pushed: 0, error: "Sem sessão Supabase" };
  if (!sheetsWebhookConfigured()) return { success: false, pushed: 0, error: "Webhook Sheets não configurado" };

  const admin = await getSupabaseAdmin();
  const maxRows = Math.min(Math.max(opts?.maxRows ?? 3600, 1), 3600);
  const { data, error } = await admin
    .from("processos")
    .select("id, protocolo_ref, dados, status, status_interno, created_by, atendido_por, empresa_id, ultimo_retorno, proximo_retorno, observacoes, datajud_ultimo_nome, datajud_ultimo_movimento, datajud_encerrado_tribunal, djen_ultimo_resumo, em_cumprimento_sentenca, updated_at")
    .eq("empresa_id", ctx.empresa_id)
    .order("id", { ascending: true })
    .limit(maxRows);
  if (error) return { success: false, pushed: 0, error: error.message };

  const rows = (data || []).map((r: any) => rowFromProcesso(r, ctx.empresa_id!)).filter((r) => r.protocolo);
  if (!rows.length) return { success: true, pushed: 0, message: "Supabase sem processos para enviar." };
  const w = await sheetsWriteRows(rows);
  if (!w.ok || w.written !== rows.length) {
    return { success: false, pushed: w.written || 0, error: w.error || `Sheets confirmou ${w.written || 0}/${rows.length}` };
  }
  return { success: true, pushed: rows.length, added: w.added, updated: w.updated };
}

/** Não sincroniza carteira automaticamente. Apenas verifica conectividade. */
export async function hybridAutoSyncAction() {
  const ctx = await getUserContext();
  if (!ctx.empresa_id) return { success: false, action: "error" as const, sheetsCount: 0, error: "Sem sessão" };
  if (!sheetsWebhookConfigured()) return { success: true, action: "noop" as const, sheetsCount: 0, message: "Sheets opcional: webhook não configurado; Supabase continua operacional." };
  const ping = await sheetsPing();
  return ping.ok
    ? { success: true, action: "ready" as const, sheetsCount: null, message: "Sheets disponível para espelhamento incremental; nenhum seed automático foi executado." }
    : { success: true, action: "fallback" as const, sheetsCount: null, message: "Sheets indisponível; Supabase continua operacional.", error: ping.error };
}

export async function hybridPushScanBatchAction(items: Array<{ protocolo: string; ultimoMovimento?: string; ultimoNome?: string; djenResumo?: string; datajudEncerrado?: boolean; proximoRetorno?: string; ultimoRetorno?: string; }>) {
  const ctx = await getUserContext();
  if (!ctx.empresa_id) return { success: false, updated: 0, error: "Sem sessão" };
  if (!sheetsWebhookConfigured()) return { success: false, updated: 0, error: "Webhook não configurado" };
  const rows: SheetsWriteRow[] = (items || []).filter((i) => i?.protocolo).map((i) => ({
    protocolo: i.protocolo,
    ultimo_movimento: [i.ultimoNome, i.ultimoMovimento].filter(Boolean).join(" · ") || undefined,
    DJEN_Resumo: i.djenResumo,
    DatajudEncerrado: i.datajudEncerrado,
    UltimoRetorno: i.ultimoRetorno,
    ProximoRetorno: i.proximoRetorno,
    EmpresaId: ctx.empresa_id,
  }));
  if (!rows.length) return { success: true, updated: 0 };
  const w = await sheetsWriteRows(rows);
  if (!w.ok) return { success: false, updated: 0, error: w.error };
  return { success: true, updated: w.written ?? rows.length };
}

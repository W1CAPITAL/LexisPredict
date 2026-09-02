"use server";

import { getUserContext, getSupabaseAdmin } from "@/lib/server-db";
import {
  getHybridMode,
  hybridEnabled,
  hybridMirrorPostgres,
  hybridSkipScanAudit,
} from "@/lib/hybrid/policy";
import {
  sheetsListProcessos,
  sheetsWriteRows,
  sheetsPing,
  sheetsWebhookConfigured,
  type SheetsWriteRow,
} from "@/lib/hybrid/sheets-server";

function str(v: unknown): string {
  if (v == null) return "";
  return String(v).trim();
}

/** Postgres processos usa proximo_retorno (NÃO proximo_prazo). */
function rowFromProcesso(r: any, empresaId: string): SheetsWriteRow {
  const d = r.dados && typeof r.dados === "object" ? r.dados : {};
  const protocolo = str(r.protocolo_ref || d.protocolo || d.PROTOCOLO || d.cnj);
  return {
    protocolo,
    Protocolo: protocolo,
    Cliente: str(d.cliente || d.CLIENTE || d.nome_cliente || r.cliente),
    Status: str(r.status || d.status || d.situacao),
    Situacao: str(r.status_interno || d.situacao || d.SITUACAO),
    UltimoRetorno: str(r.ultimo_retorno || d.ultimoRetorno || d.ultimo_retorno),
    ProximoRetorno: str(
      r.proximo_retorno || d.proximoRetorno || d.proximo_retorno || d.PROXIMO_RETORNO
    ),
    Advogado: str(d.advogado || d.ADVOGADO),
    Telefone: str(d.telefone || d.TELEFONE || d.celular),
    CreatedBy: str(r.created_by || d.created_by),
    Responsavel: str(r.created_by || d.created_by || d.responsavel),
    AtendidoPor: str(r.atendido_por || d.atendido_por),
    Observacao: str(r.observacoes || d.observacao || d.observacoes),
    EmpresaId: str(r.empresa_id || empresaId),
    Tribunal: str(d.tribunal || d.TRIBUNAL),
    ultimo_movimento: str(r.datajud_ultimo_nome || d.datajud_ultimo_nome),
    DJEN_Resumo: str(r.djen_ultimo_resumo || d.djen_ultimo_resumo).slice(0, 500),
    DatajudEncerrado: !!(r.datajud_encerrado_tribunal || d.datajud_encerrado_tribunal),
    Cumprimento: str(d.em_cumprimento_sentenca || r.em_cumprimento_sentenca || ""),
    updated_at: str(r.updated_at || new Date().toISOString()),
  };
}

export async function hybridStatusAction() {
  const mode = getHybridMode();
  const configured = sheetsWebhookConfigured();
  let ping: { ok: boolean; error?: string; json?: any } = { ok: false, error: "não testado" };
  let sheetsCount: number | null = null;
  let listError: string | undefined;

  if (configured) {
    ping = await sheetsPing();
    if (ping.ok) {
      const list = await sheetsListProcessos({ limit: 5 });
      if (list.ok) {
        // count approx: list may return only limit — full count via second call
        const full = await sheetsListProcessos({ limit: 8000 });
        sheetsCount = full.ok ? full.rows.length : list.rows.length;
        if (!full.ok) listError = full.error;
      } else {
        listError = list.error;
        sheetsCount = 0;
      }
    }
  }

  const synced =
    hybridEnabled() && configured && !!ping.ok && sheetsCount !== null && sheetsCount > 0;

  return {
    mode,
    enabled: hybridEnabled(),
    webhookConfigured: configured,
    mirrorPostgres: hybridMirrorPostgres(),
    skipScanAudit: hybridSkipScanAudit(),
    ping,
    sheetsCount,
    listError,
    synced,
    syncLabel: !hybridEnabled()
      ? "Híbrido desligado"
      : !configured
        ? "Webhook não configurado"
        : !ping.ok
          ? `Ping falhou: ${ping.error || "?"}`
          : sheetsCount === 0
            ? "Planilha vazia — rode sync (seed)"
            : `Sincronizado · ${sheetsCount} processos na planilha`,
    carteiraSource: synced ? "sheets" : "supabase",
    spreadsheetHint: "1qbuJee6DCv0bh9XGvnBDPltc0Ziphdn2yx11QKOnchc",
  };
}

export async function hybridPullCarteiraAction(opts?: { limit?: number }) {
  const ctx = await getUserContext();
  if (!ctx.empresa_id) return { success: false, rows: [], error: "Sem sessão Supabase" };
  if (!hybridEnabled()) return { success: false, rows: [], error: "Hybrid desligado" };
  if (!sheetsWebhookConfigured()) return { success: false, rows: [], error: "Webhook não configurado" };

  const list = await sheetsListProcessos({
    empresaId: ctx.empresa_id,
    limit: opts?.limit ?? 8000,
  });
  if (!list.ok) return { success: false, rows: [], error: list.error };
  return { success: true, rows: list.rows, count: list.rows.length, source: "sheets" as const };
}

export async function hybridSeedSheetsFromSupabaseAction(opts?: { maxRows?: number }) {
  const ctx = await getUserContext();
  if (!ctx.empresa_id || !ctx.auth_id) {
    return { success: false, pushed: 0, error: "Sem sessão Supabase" };
  }
  if (!hybridEnabled()) return { success: false, pushed: 0, error: "Hybrid desligado" };
  if (!sheetsWebhookConfigured()) {
    return { success: false, pushed: 0, error: "Webhook Sheets não configurado" };
  }

  const admin = await getSupabaseAdmin();
  const maxRows = Math.min(Math.max(opts?.maxRows ?? 4000, 1), 8000);
  const all: any[] = [];
  let offset = 0;
  const page = 500;

  while (all.length < maxRows) {
    const { data, error } = await admin
      .from("processos")
      .select(
        "id, protocolo_ref, dados, status, status_interno, created_by, atendido_por, empresa_id, ultimo_retorno, proximo_retorno, observacoes, datajud_ultimo_nome, datajud_encerrado_tribunal, djen_ultimo_resumo, em_cumprimento_sentenca, updated_at"
      )
      .eq("empresa_id", ctx.empresa_id)
      .order("id", { ascending: true })
      .range(offset, offset + page - 1);

    if (error) return { success: false, pushed: 0, error: error.message };
    const chunk = data || [];
    if (!chunk.length) break;
    all.push(...chunk);
    offset += page;
    if (chunk.length < page) break;
  }

  const rows = all
    .map((r) => rowFromProcesso(r, ctx.empresa_id!))
    .filter((r) => r.protocolo);

  if (!rows.length) {
    return { success: true, pushed: 0, error: "Supabase sem processos para enviar" };
  }

  let pushed = 0;
  const samples: string[] = [];
  const batchSize = 8;
  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    const w = await sheetsWriteRows(batch);
    if (!w.ok) {
      return {
        success: pushed > 0,
        pushed,
        error: w.error || "Falha no write Sheets",
        samples,
      };
    }
    pushed += batch.length;
    if (samples.length < 5) samples.push(batch[0].protocolo);
  }

  return { success: true, pushed, samples };
}

export async function hybridAutoSyncAction() {
  const ctx = await getUserContext();
  if (!ctx.empresa_id) {
    return { success: false, action: "error" as const, sheetsCount: 0, error: "Sem sessão" };
  }
  if (!hybridEnabled()) {
    return {
      success: true,
      action: "noop" as const,
      sheetsCount: 0,
      message: "Hybrid off — LEXIS_HYBRID_MODE=sheets_carteira_scan",
    };
  }
  if (!sheetsWebhookConfigured()) {
    return { success: false, action: "error" as const, sheetsCount: 0, error: "Webhook não configurado" };
  }

  const ping = await sheetsPing();
  if (!ping.ok) {
    return {
      success: false,
      action: "error" as const,
      sheetsCount: 0,
      error: ping.error || "Ping Sheets falhou",
    };
  }

  const list = await sheetsListProcessos({ empresaId: ctx.empresa_id, limit: 20 });
  if (!list.ok) {
    return { success: false, action: "error" as const, sheetsCount: 0, error: list.error };
  }

  if (list.rows.length === 0) {
    const seed = await hybridSeedSheetsFromSupabaseAction({ maxRows: 4000 });
    if (!seed.success && seed.pushed === 0) {
      return {
        success: false,
        action: "error" as const,
        sheetsCount: 0,
        error: seed.error,
        message: "Planilha vazia; falha seed Supabase → Sheets",
      };
    }
    return {
      success: true,
      action: "seed" as const,
      sheetsCount: 0,
      pushed: seed.pushed,
      message: `Planilha vazia → enviados ${seed.pushed} processos`,
    };
  }

  const full = await sheetsListProcessos({ empresaId: ctx.empresa_id, limit: 8000 });
  if (!full.ok) {
    return {
      success: false,
      action: "error" as const,
      sheetsCount: list.rows.length,
      error: full.error,
    };
  }

  return {
    success: true,
    action: "pull" as const,
    sheetsCount: full.rows.length,
    pulled: full.rows.length,
    message: `Sincronizado · ${full.rows.length} linhas na planilha`,
  };
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
  const rows: SheetsWriteRow[] = (items || [])
    .filter((i) => i.protocolo)
    .map((i) => ({
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

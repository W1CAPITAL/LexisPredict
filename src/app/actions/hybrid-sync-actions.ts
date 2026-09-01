"use server";

/**
 * Sync híbrido: Supabase (auth/empresa) ↔ Sheets (carteira M/N + scan).
 * Reduz carga em processos/auditoria no Postgres.
 */

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

export async function hybridStatusAction() {
  const mode = getHybridMode();
  const configured = sheetsWebhookConfigured();
  let ping: { ok: boolean; error?: string } = { ok: false, error: "não testado" };
  if (configured) {
    ping = await sheetsPing();
  }
  return {
    mode,
    enabled: hybridEnabled(),
    webhookConfigured: configured,
    mirrorPostgres: hybridMirrorPostgres(),
    skipScanAudit: hybridSkipScanAudit(),
    ping,
  };
}

/**
 * Puxa carteira da planilha (fonte operacional).
 * Não varre a tabela processos do Postgres.
 */
export async function hybridPullCarteiraAction(opts?: { limit?: number }) {
  const ctx = await getUserContext();
  if (!ctx.empresa_id) return { success: false, rows: [], error: "Sem sessão Supabase" };
  if (!hybridEnabled()) {
    return { success: false, rows: [], error: "Hybrid desligado (LEXIS_HYBRID_MODE)" };
  }
  if (!sheetsWebhookConfigured()) {
    return { success: false, rows: [], error: "Webhook Sheets não configurado" };
  }

  // cargo: operadores veem só o próprio; supervisor vê tudo (filtrado no script se houver)
  const admin = await getSupabaseAdmin();
  let responsavel: string | undefined;
  try {
    const { data: me } = await admin
      .from("usuarios")
      .select("cargo, role, nome, auth_user_id")
      .eq("empresa_id", ctx.empresa_id)
      .eq("auth_user_id", ctx.auth_id || "")
      .maybeSingle();
    const cargo = `${me?.cargo || ""} ${me?.role || ""}`.toLowerCase();
    const isSup =
      /super\s*admin|superadmin|\bsupervisor\b/.test(cargo) || !!(ctx as any).isSuperAdmin;
    if (!isSup) {
      responsavel = String(me?.auth_user_id || ctx.auth_id || me?.nome || "");
    }
  } catch {
    responsavel = ctx.auth_id || undefined;
  }

  const list = await sheetsListProcessos({
    empresaId: ctx.empresa_id,
    responsavel,
    limit: opts?.limit ?? 5000,
  });
  if (!list.ok) return { success: false, rows: [], error: list.error };
  return {
    success: true,
    rows: list.rows,
    count: list.rows.length,
    source: "sheets",
  };
}

/**
 * Empurra resultado de scan (DataJud/DJEN) para a planilha.
 * Evita update massivo em processos + auditoria no Postgres.
 */
export async function hybridPushScanResultAction(input: {
  protocolo: string;
  ultimoMovimento?: string;
  ultimoNome?: string;
  djenResumo?: string;
  datajudEncerrado?: boolean;
  cumprimento?: string;
  ultimoRetorno?: string;
  proximoRetorno?: string;
  observacao?: string;
}): Promise<{ success: boolean; error?: string; mirroredPg?: boolean }> {
  const ctx = await getUserContext();
  if (!ctx.empresa_id) return { success: false, error: "Sem sessão" };
  if (!hybridEnabled()) return { success: false, error: "Hybrid desligado" };

  const proto = String(input.protocolo || "").trim();
  if (!proto) return { success: false, error: "Protocolo vazio" };

  const row: SheetsWriteRow = {
    protocolo: proto,
    ultimo_movimento: [input.ultimoNome, input.ultimoMovimento].filter(Boolean).join(" · ") || undefined,
    DJEN_Resumo: input.djenResumo,
    DatajudEncerrado: input.datajudEncerrado,
    Cumprimento: input.cumprimento,
    UltimoRetorno: input.ultimoRetorno,
    ProximoRetorno: input.proximoRetorno,
    Observacao: input.observacao,
    AtendidoPor: ctx.auth_id || undefined,
  };

  const w = await sheetsWriteRows([row]);
  if (!w.ok) return { success: false, error: w.error };

  let mirroredPg = false;
  if (hybridMirrorPostgres()) {
    try {
      const admin = await getSupabaseAdmin();
      const dig = proto.replace(/\D/g, "");
      const { data: rows } = await admin
        .from("processos")
        .select("id, protocolo_ref, dados")
        .eq("empresa_id", ctx.empresa_id)
        .limit(2000);
      const hit = (rows || []).find((r: any) => {
        const ref = String(r.protocolo_ref || "").replace(/\D/g, "");
        return ref === dig || ref.endsWith(dig) || dig.endsWith(ref);
      });
      if (hit) {
        const dados = { ...(hit.dados || {}) };
        if (input.ultimoNome) dados.datajud_ultimo_nome = input.ultimoNome;
        if (input.ultimoMovimento) dados.datajud_ultimo_movimento = input.ultimoMovimento;
        if (input.djenResumo) dados.djen_ultimo_resumo = input.djenResumo;
        if (input.datajudEncerrado != null) {
          dados.datajud_encerrado_tribunal = input.datajudEncerrado;
        }
        await admin
          .from("processos")
          .update({
            dados,
            datajud_ultimo_nome: input.ultimoNome || undefined,
            datajud_encerrado_tribunal: input.datajudEncerrado ?? undefined,
          })
          .eq("id", hit.id)
          .eq("empresa_id", ctx.empresa_id);
        mirroredPg = true;
      }
    } catch {
      /* espelho PG é best-effort */
    }
  }

  return { success: true, mirroredPg };
}

/**
 * Lote: vários resultados de scan → uma chamada Sheets.
 */
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
): Promise<{ success: boolean; updated: number; error?: string }> {
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

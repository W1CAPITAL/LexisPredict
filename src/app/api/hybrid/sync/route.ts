import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/server-db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// O problema anterior era combinar payload grande + ping + COUNT em todo lote.
// Agora cada lote faz apenas: 1 leitura Supabase + 1 chamada ao Apps Script.
const DEFAULT_BATCH = 75;
const MAX_BATCH = 100;
const SHEETS_TIMEOUT_MS = 12_000;
const WEBHOOK_ACTION = "upsert_batch";

function env(name: string) {
  return String(process.env[name] || "").trim();
}

function jsonError(message: string, status = 500, extra: Record<string, unknown> = {}) {
  return NextResponse.json({ ok: false, error: message, ...extra }, { status });
}

async function resolveEmpresaId() {
  const configured = env("LEXIS_HYBRID_EMPRESA_ID");
  if (configured) return configured;
  throw new Error("LEXIS_HYBRID_EMPRESA_ID não configurado. O Plano B não deve depender do auth/realtime do navegador.");
}

function normalizeRows(rows: Record<string, any>[]) {
  return rows.map((row) => {
    const d = row?.dados && typeof row.dados === "object" ? row.dados : {};
    return {
      ...d,
      ...row,
      protocolo: row.protocolo_ref ?? row.protocolo ?? d.protocolo ?? d.PROTOCOLO ?? "",
      cliente: row.cliente ?? d.cliente ?? d.CLIENTE ?? "",
      telefone: row.telefone ?? d.telefone ?? d.phone ?? d.celular ?? d.whatsapp ?? "",
      advogado: row.advogado ?? d.advogado ?? d.ADVOGADO ?? "",
      escritorio: row.escritorio ?? d.escritorio ?? d.ESCRITORIO ?? "",
      tribunal: row.tribunal ?? d.tribunal ?? d.TRIBUNAL ?? "",
      status: row.status ?? d.status ?? "",
      situacao: row.status_interno ?? d.situacao ?? d.status_interno ?? "",
      UltimoRetorno: row.ultimo_retorno ?? row.ultimoRetorno ?? d.ultimoRetorno ?? d.ultimo_retorno ?? "",
      ProximoRetorno: row.proximo_retorno ?? row.proximoRetorno ?? d.proximoRetorno ?? d.proximo_retorno ?? "",
      CreatedBy: row.created_by ?? row.createdBy ?? d.created_by ?? d.createdBy ?? "",
      AtendidoPor: row.atendido_por ?? row.atendidoPor ?? d.atendido_por ?? d.atendidoPor ?? "",
      Observacao: row.observacoes ?? row.observacao ?? d.observacoes ?? d.observacao ?? "",
      updated_at: row.updated_at ?? row.updatedAt ?? d.updated_at ?? d.updatedAt ?? "",
    };
  });
}

function scalar(value: unknown) {
  if (value == null) return "";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function toMatrix(rows: Record<string, any>[]) {
  const preferred = [
    "id", "Protocolo", "Cliente", "Status", "Situacao", "UltimoRetorno", "ProximoRetorno",
    "Advogado", "Escritorio", "Tribunal", "Telefone", "CreatedBy", "AtendidoPor", "Observacao",
    "DatajudEncerrado", "EmpresaId", "empresa_id", "isBaixaTribunal", "ultimo_movimento", "fase",
    "valor_causa", "updated_at", "Assistente", "Distribuicao", "Produtos", "Data_Movimentacao",
    "Andamento", "Evento_Tipo", "Novo_Andamento", "Busca_Apreensao", "Cumprimento", "DJEN_Resumo",
    "Dias_Sem_Retorno", "Procedente", "Improcedente"
  ];

  const keys = Array.from(new Set(rows.flatMap((r) => Object.keys(r))));
  const headers = [
    ...preferred.filter((k) => keys.some((actual) => actual === k)),
    ...keys.filter((k) => !preferred.includes(k) && k !== "dados"),
  ];

  const matrix = rows.map((r) => headers.map((h) => scalar(r[h])));
  return { headers, matrix };
}

async function callSheets(payload: Record<string, unknown>) {
  const webhook = env("LEXIS_SHEETS_WEBHOOK_URL");
  const token = env("LEXIS_SHEETS_TOKEN");
  if (!webhook) return { ok: false, error: "LEXIS_SHEETS_WEBHOOK_URL não configurada." };
  if (!token) return { ok: false, error: "LEXIS_SHEETS_TOKEN não configurado." };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SHEETS_TIMEOUT_MS);
  try {
    const response = await fetch(webhook, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      cache: "no-store",
      signal: controller.signal,
      body: JSON.stringify({ ...payload, token }),
    });
    const raw = await response.text();
    let json: any = {};
    try { json = JSON.parse(raw || "{}"); } catch (_) {}
    if (!response.ok) return { ok: false, error: `Webhook HTTP ${response.status}: ${raw.slice(0, 300)}`, json };
    if (json?.ok !== true) return { ok: false, error: json?.error || "Apps Script não confirmou ok:true.", json };
    return { ok: true, json };
  } catch (error: any) {
    return {
      ok: false,
      error: error?.name === "AbortError" ? `Webhook excedeu ${SHEETS_TIMEOUT_MS / 1000}s.` : (error?.message || String(error)),
    };
  } finally {
    clearTimeout(timer);
  }
}

export async function GET() {
  try {
    const empresaId = await resolveEmpresaId();
    const admin = await getSupabaseAdmin();

    // Health do Sheets é independente da sessão/realtime do navegador.
    const sheet = await callSheets({ action: "ping" });
    const { count, error } = await admin
      .from("processos")
      .select("id", { count: "exact", head: true })
      .eq("empresa_id", empresaId);

    if (error) throw new Error(error.message);

    return NextResponse.json({
      ok: true,
      supabase: "ok",
      sheetsWorking: sheet.ok,
      webhook: sheet.ok ? "ok" : "fail",
      fallback: sheet.ok ? null : "supabase",
      total: count ?? 0,
      empresaId,
      webhookError: sheet.ok ? undefined : sheet.error,
      message: sheet.ok
        ? "Plano B disponível: Google Sheets."
        : "Google Sheets indisponível. O Lexis continua operando pelo Supabase.",
    });
  } catch (error: any) {
    return jsonError(error?.message || String(error), 500, {
      fallback: "supabase",
      sheetsWorking: false,
    });
  }
}

export async function POST(req: NextRequest) {
  const started = Date.now();
  try {
    const body = await req.json();
    if (body?.action !== "seed_batch") return jsonError("Ação inválida.", 400);

    const empresaId = await resolveEmpresaId();
    const admin = await getSupabaseAdmin();
    const batchSize = Math.min(MAX_BATCH, Math.max(1, Number(body?.batchSize || DEFAULT_BATCH)));
    const cursor = body?.cursor ? String(body.cursor) : null;

    let query = admin
      .from("processos")
      .select("*")
      .eq("empresa_id", empresaId)
      .order("id", { ascending: true })
      .limit(batchSize);

    if (cursor) query = query.gt("id", cursor);

    const { data, error } = await query;
    if (error) throw new Error(`Leitura da carteira falhou: ${error.message}`);

    const rawRows = (data || []) as Record<string, any>[];
    if (!rawRows.length) {
      return NextResponse.json({
        ok: true,
        total: Number(body?.total || 0),
        processed: 0,
        accepted: 0,
        nextCursor: null,
        hasMore: false,
        sheetsWorking: true,
        sheetWritten: 0,
        elapsedMs: Date.now() - started,
      });
    }

    const rows = normalizeRows(rawRows);
    const { headers, matrix } = toMatrix(rows);
    const nextCursor = String(rawRows[rawRows.length - 1]?.id ?? "") || null;
    const hasMore = rawRows.length === batchSize;

    const sheet = await callSheets({
      action: WEBHOOK_ACTION,
      source: "LexisPredict",
      mode: "sheets_carteira_scan",
      seed: true,
      empresa_id: empresaId,
      batch_size: rows.length,
      actor: "sync",
      actor_name: "LexisPredict / Plano B",
      perfil: "superadmin",
      cursor,
      next_cursor: hasMore ? nextCursor : null,
      has_more: hasMore,
      headers,
      matrix,
      rows,
    });

    if (!sheet.ok) {
      // Fallback: o Supabase continua sendo a fonte operacional. Não avançamos checkpoint.
      return NextResponse.json({
        ok: false,
        fallback: "supabase",
        supabase: "ok",
        sheetsWorking: false,
        recoverable: true,
        processed: 0,
        accepted: 0,
        nextCursor: cursor,
        hasMore: true,
        elapsedMs: Date.now() - started,
        error: `Google Sheets indisponível: ${sheet.error}`,
        message: "O lote não foi confirmado pela planilha; o Lexis continua pelo Supabase.",
      });
    }

    const json = sheet.json || {};
    const written = Number(json.written ?? 0);
    const rejected = Number(json.rejected_count ?? (Array.isArray(json.rejected) ? json.rejected.length : 0));
    const accepted = written || Number(json.updated ?? 0) + Number(json.added ?? 0);

    if (accepted !== rows.length || rejected > 0) {
      return NextResponse.json({
        ok: false,
        fallback: "supabase",
        supabase: "ok",
        sheetsWorking: false,
        recoverable: true,
        processed: 0,
        accepted: 0,
        nextCursor: cursor,
        hasMore: true,
        elapsedMs: Date.now() - started,
        error: `Apps Script confirmou ${accepted}/${rows.length} registros (${rejected} rejeitados).`,
        message: "Checkpoint não avançado para evitar perder registros.",
      });
    }

    return NextResponse.json({
      ok: true,
      total: Number(body?.total || 0),
      processed: rows.length,
      accepted,
      nextCursor: hasMore ? nextCursor : null,
      hasMore,
      sheetsWorking: true,
      sheetWritten: accepted,
      sheetUpdated: Number(json.updated ?? 0),
      sheetAdded: Number(json.added ?? 0),
      elapsedMs: Date.now() - started,
    });
  } catch (error: any) {
    return jsonError(error?.message || String(error), 500, { fallback: "supabase" });
  }
}

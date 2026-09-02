import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getSupabaseAdmin, getUserContext } from "@/lib/server-db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEFAULT_BATCH = 500;
const MAX_BATCH = 500;
const WEBHOOK_TIMEOUT_MS = 30000;

function env(name: string) {
  return String(process.env[name] || "").trim();
}

function jsonError(message: string, status = 500) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

async function resolveEmpresaId() {
  const configured = env("LEXIS_HYBRID_EMPRESA_ID");
  if (configured) return configured;

  // LexisPredict already uses public.usuarios as its application user/profile
  // table. Do NOT query public.profiles: that table does not exist in this DB.
  const ctx = await getUserContext();
  if (!ctx.empresa_id) {
    throw new Error("Não foi possível identificar a empresa pela sessão do Lexis. Configure LEXIS_HYBRID_EMPRESA_ID se necessário.");
  }
  return String(ctx.empresa_id);
}

async function postToSheets(payload: unknown) {
  const webhook = env("LEXIS_SHEETS_WEBHOOK_URL");
  if (!webhook) throw new Error("LEXIS_SHEETS_WEBHOOK_URL não configurada.");

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), WEBHOOK_TIMEOUT_MS);
  const token = env("LEXIS_SHEETS_TOKEN");

  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Accept: "application/json,text/plain,*/*",
      "X-Lexis-Mode": "batch",
    };
    if (token) {
      headers.Authorization = `Bearer ${token}`;
      headers["X-Lexis-Token"] = token;
    }

    const res = await fetch(webhook, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
      cache: "no-store",
      signal: controller.signal,
    });
    const text = await res.text();
    if (!res.ok) throw new Error(`Webhook HTTP ${res.status}: ${text.slice(0, 400)}`);
    return text;
  } catch (error: any) {
    if (error?.name === "AbortError") throw new Error("Webhook excedeu o tempo limite de 30s.");
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

function normalizeRows(rows: Record<string, any>[]) {
  return rows.map((row) => {
    const d = row?.dados && typeof row.dados === "object" ? row.dados : {};
    return {
      ...row,
      protocolo: row.protocolo_ref ?? d.protocolo ?? d.PROTOCOLO ?? "",
      cliente: row.cliente ?? d.cliente ?? d.CLIENTE ?? "",
      telefone: row.telefone ?? d.telefone ?? d.phone ?? "",
      advogado: row.advogado ?? d.advogado ?? d.ADVOGADO ?? "",
      escritorio: row.escritorio ?? d.escritorio ?? d.ESCRITORIO ?? "",
      tribunal: row.tribunal ?? d.tribunal ?? d.TRIBUNAL ?? "",
      status: row.status ?? d.status ?? "",
      situacao: row.status_interno ?? d.situacao ?? d.status_interno ?? "",
      ultimoRetorno: row.ultimo_retorno ?? d.ultimoRetorno ?? d.ultimo_retorno ?? "",
      proximoRetorno: row.proximo_retorno ?? d.proximoRetorno ?? d.proximo_retorno ?? "",
      criado_por: row.created_by ?? "",
      observacoes: row.observacoes ?? d.observacoes ?? d.observacao ?? "",
      andamento: d.ultimoAndamento ?? d.andamento ?? "",
      evento_tipo: d.evento_tipo ?? "",
    };
  });
}

function toMatrix(rows: Record<string, any>[]) {
  const preferred = [
    "id", "protocolo", "cliente", "telefone", "advogado", "escritorio", "tribunal",
    "status", "situacao", "ultimoRetorno", "proximoRetorno", "criado_por",
    "observacoes", "andamento", "evento_tipo", "empresa_id", "created_at", "updated_at",
  ];
  const keys = Array.from(new Set(rows.flatMap((r) => Object.keys(r))));
  const headers = [
    ...preferred.filter((k) => keys.includes(k)),
    ...keys.filter((k) => !preferred.includes(k) && k !== "dados"),
  ];
  const matrix = rows.map((r) => headers.map((k) => {
    const v = r[k];
    if (v == null) return "";
    if (typeof v === "object") return JSON.stringify(v);
    return String(v);
  }));
  return { headers, matrix };
}

export async function GET() {
  try {
    const empresaId = await resolveEmpresaId();
    const admin = await getSupabaseAdmin();
    const { count, error } = await admin
      .from("processos")
      .select("id", { count: "exact", head: true })
      .eq("empresa_id", empresaId);

    if (error) throw new Error(error.message);

    return NextResponse.json({
      ok: true,
      mode: env("LEXIS_HYBRID_MODE") || "sheets_carteira_scan",
      supabase: "ok",
      webhook: env("LEXIS_SHEETS_WEBHOOK_URL") ? "ok" : "not-configured",
      total: count ?? 0,
      empresaId,
    });
  } catch (error: any) {
    return jsonError(error?.message || String(error), 500);
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

    const countResult = await admin
      .from("processos")
      .select("id", { count: "exact", head: true })
      .eq("empresa_id", empresaId);
    if (countResult.error) throw new Error(`Contagem da carteira falhou: ${countResult.error.message}`);

    // Cursor por id evita o custo crescente de OFFSET e permite retomar após falha.
    let query = admin
      .from("processos")
      .select("*")
      .eq("empresa_id", empresaId)
      .order("id", { ascending: true })
      .limit(batchSize);
    if (body?.cursor) query = query.gt("id", body.cursor);

    const { data, error } = await query;
    if (error) throw new Error(`Leitura da carteira falhou: ${error.message}`);

    const rawRows = (data || []) as Record<string, any>[];
    const rows = normalizeRows(rawRows);
    const { headers, matrix } = toMatrix(rows);
    const nextCursor = rawRows.length ? String(rawRows[rawRows.length - 1].id) : null;
    const hasMore = rawRows.length === batchSize;

    if (rows.length) {
      await postToSheets({
        action: "upsert_batch",
        source: "LexisPredict",
        mode: "sheets_carteira_scan",
        empresa_id: empresaId,
        batch_size: rows.length,
        cursor: body?.cursor ?? null,
        next_cursor: hasMore ? nextCursor : null,
        has_more: hasMore,
        headers,
        matrix,
        rows,
      });
    }

    return NextResponse.json({
      ok: true,
      total: countResult.count ?? 0,
      processed: rows.length,
      accepted: rows.length,
      nextCursor: hasMore ? nextCursor : null,
      hasMore,
      elapsedMs: Date.now() - started,
    });
  } catch (error: any) {
    return jsonError(error?.message || String(error), 500);
  }
}

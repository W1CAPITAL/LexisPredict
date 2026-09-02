import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin, getUserContext } from "@/lib/server-db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Lotes menores evitam timeout no Apps Script/Vercel sem voltar ao modelo 1 linha = 1 request.
const DEFAULT_BATCH = 250;
const MAX_BATCH = 250;
const WEBHOOK_ACTION = "upsert_batch";

function env(name: string) {
  return String(process.env[name] || "").trim();
}

const SHEETS_TIMEOUT_MS = 12_000;

async function directSheetsFetch(payload: Record<string, unknown>, timeoutMs = SHEETS_TIMEOUT_MS) {
  const webhook = env("LEXIS_SHEETS_WEBHOOK_URL");
  const token = env("LEXIS_SHEETS_TOKEN");
  if (!webhook) return { ok: false, error: "LEXIS_SHEETS_WEBHOOK_URL não configurada." };
  if (!token) return { ok: false, error: "LEXIS_SHEETS_TOKEN não configurado." };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(webhook, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      cache: "no-store",
      signal: controller.signal,
      // O Apps Script valida o token no BODY; não dependemos de header customizado.
      body: JSON.stringify({ ...payload, token }),
    });
    const raw = await response.text();
    let json: any = {};
    try { json = JSON.parse(raw || "{}"); } catch (_) {}
    if (!response.ok) {
      return { ok: false, error: `Webhook HTTP ${response.status}: ${raw.slice(0, 300)}`, json };
    }
    if (json?.ok !== true) {
      return { ok: false, error: json?.error || "Apps Script não confirmou ok:true.", json };
    }
    return { ok: true, json };
  } catch (error: any) {
    return {
      ok: false,
      error: error?.name === "AbortError"
        ? `Webhook excedeu ${Math.round(timeoutMs / 1000)}s.`
        : error?.message || String(error),
    };
  } finally {
    clearTimeout(timer);
  }
}

function jsonError(message: string, status = 500, extra: Record<string, unknown> = {}) {
  return NextResponse.json({ ok: false, error: message, ...extra }, { status });
}

async function resolveEmpresaId() {
  const configured = env("LEXIS_HYBRID_EMPRESA_ID");
  if (configured) return configured;
  const ctx = await getUserContext();
  if (!ctx.empresa_id) {
    throw new Error(
      "Não foi possível identificar a empresa pela sessão do Lexis. Configure LEXIS_HYBRID_EMPRESA_ID se necessário.",
    );
  }
  return String(ctx.empresa_id);
}

function normalizeRows(rows: Record<string, any>[]) {
  return rows.map((row) => {
    const d = row?.dados && typeof row.dados === "object" ? row.dados : {};
    return {
      ...row,
      protocolo: row.protocolo_ref ?? row.protocolo ?? d.protocolo ?? d.PROTOCOLO ?? "",
      cliente: row.cliente ?? d.cliente ?? d.CLIENTE ?? "",
      telefone: row.telefone ?? d.telefone ?? d.phone ?? "",
      advogado: row.advogado ?? d.advogado ?? d.ADVOGADO ?? "",
      escritorio: row.escritorio ?? d.escritorio ?? d.ESCRITORIO ?? "",
      tribunal: row.tribunal ?? d.tribunal ?? d.TRIBUNAL ?? "",
      status: row.status ?? d.status ?? "",
      situacao: row.status_interno ?? d.situacao ?? d.status_interno ?? "",
      ultimoRetorno: row.ultimo_retorno ?? d.ultimoRetorno ?? d.ultimo_retorno ?? "",
      proximoRetorno: row.proximo_retorno ?? d.proximoRetorno ?? d.proximo_retorno ?? "",
      criado_por: row.created_by ?? d.created_by ?? "",
      AtendidoPor: row.atendido_por ?? d.atendido_por ?? d.AtendidoPor ?? "",
      Observacao: row.observacoes ?? row.observacao ?? d.observacoes ?? d.observacao ?? "",
      andamento: d.ultimoAndamento ?? d.andamento ?? row.ultimo_movimento ?? "",
      evento_tipo: d.evento_tipo ?? d.Evento_Tipo ?? "",
    };
  });
}

function toMatrix(rows: Record<string, any>[]) {
  const preferred = [
    "id",
    "protocolo",
    "protocolo_ref",
    "cliente",
    "telefone",
    "advogado",
    "escritorio",
    "tribunal",
    "status",
    "status_interno",
    "situacao",
    "ultimoRetorno",
    "ultimo_retorno",
    "proximoRetorno",
    "proximo_retorno",
    "created_by",
    "criado_por",
    "atendido_por",
    "AtendidoPor",
    "observacoes",
    "Observacao",
    "andamento",
    "evento_tipo",
    "empresa_id",
    "created_at",
    "updated_at",
  ];

  const keys = Array.from(
    new Set(rows.flatMap((r) => Object.keys(r)).filter((key) => key !== "dados")),
  );
  const headers = [
    ...preferred.filter((k) => keys.includes(k)),
    ...keys.filter((k) => !preferred.includes(k)),
  ];
  const matrix = rows.map((r) =>
    headers.map((k) => {
      const v = r[k];
      if (v == null) return "";
      if (typeof v === "object") return JSON.stringify(v);
      return String(v);
    }),
  );
  return { headers, matrix };
}

async function sheetsHealth() {
  const result = await directSheetsFetch({ action: "ping" }, 5_000);
  return { ok: result.ok, error: result.ok ? undefined : result.error };
}

export async function GET() {
  try {
    const empresaId = await resolveEmpresaId();
    const admin = await getSupabaseAdmin();
    const [{ count, error: countError }, sheet] = await Promise.all([
      admin
        .from("processos")
        .select("id", { count: "exact", head: true })
        .eq("empresa_id", empresaId),
      sheetsHealth(),
    ]);

    if (countError) throw new Error(countError.message);

    const sheetsWorking = !!sheet.ok;
    return NextResponse.json({
      ok: true,
      mode: sheetsWorking ? env("LEXIS_HYBRID_MODE") || "sheets_carteira_scan" : "supabase_fallback",
      supabase: "ok",
      webhook: sheetsWorking ? "ok" : "fail",
      sheetsWorking,
      fallback: sheetsWorking ? null : "supabase",
      total: count ?? 0,
      empresaId,
      webhookError: sheetsWorking ? undefined : sheet.error,
      message: sheetsWorking
        ? "Plano B disponível: Google Sheets."
        : "Google Sheets indisponível. O Lexis continua operando normalmente pelo Supabase.",
    });
  } catch (error: any) {
    return jsonError(error?.message || String(error), 500, {
      supabase: "fail",
      sheetsWorking: false,
      fallback: "supabase",
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
    const batchSize = Math.min(
      MAX_BATCH,
      Math.max(1, Number(body?.batchSize || DEFAULT_BATCH)),
    );

    const sheet = await sheetsHealth();
    // Fallback deliberado: se Sheets não responder, não inventamos que o lote foi salvo.
    // A operação normal continua no Supabase e o checkpoint NÃO avança.
    if (!sheet.ok) {
      return NextResponse.json({
        ok: false,
        fallback: "supabase",
        sheetsWorking: false,
        supabase: "ok",
        recoverable: true,
        processed: 0,
        accepted: 0,
        nextCursor: body?.cursor ?? null,
        hasMore: true,
        elapsedMs: Date.now() - started,
        error: `Google Sheets indisponível: ${sheet.error || "sem resposta"}`,
        message: "Plano B indisponível; o Lexis permanece operando pelo Supabase.",
      }, { status: 200 });
    }

    const countResult = await admin
      .from("processos")
      .select("id", { count: "exact", head: true })
      .eq("empresa_id", empresaId);
    if (countResult.error) {
      throw new Error(`Contagem da carteira falhou: ${countResult.error.message}`);
    }

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
    const nextCursor = rawRows.length
      ? String(rawRows[rawRows.length - 1]?.id ?? "") || null
      : null;
    const hasMore = rawRows.length === batchSize;

    if (!rows.length) {
      return NextResponse.json({
        ok: true,
        total: countResult.count ?? 0,
        processed: 0,
        accepted: 0,
        nextCursor: null,
        hasMore: false,
        elapsedMs: Date.now() - started,
        sheetsWorking: true,
        sheetWritten: 0,
        sheetUpdated: 0,
        sheetAdded: 0,
      });
    }

    try {
      const result = await directSheetsFetch({
        action: WEBHOOK_ACTION,
        source: "LexisPredict",
        mode: "sheets_carteira_scan",
        empresa_id: empresaId,
        batch_size: rows.length,
        actor: "sync",
        actor_name: "LexisPredict / Plano B",
        perfil: "superadmin",
        cursor: body?.cursor ?? null,
        next_cursor: hasMore ? nextCursor : null,
        has_more: hasMore,
        headers,
        matrix,
        rows,
      });

      if (!result.ok) throw new Error(result.error || "Apps Script recusou o lote.");

      const json = result.json || {};

      const written = Number(json.written ?? json.updated ?? json.added ?? 0);
      if (written !== rows.length) {
        throw new Error(`Apps Script confirmou apenas ${written}/${rows.length} registros.`);
      }

      return NextResponse.json({
        ok: true,
        total: countResult.count ?? 0,
        processed: rows.length,
        accepted: written,
        nextCursor: hasMore ? nextCursor : null,
        hasMore,
        elapsedMs: Date.now() - started,
        sheetsWorking: true,
        sheetUpdated: Number(json.updated ?? 0),
        sheetAdded: Number(json.added ?? 0),
        sheetWritten: written,
      });
    } catch (sheetError: any) {
      // Fallback apenas quando o Plano B falhar; nunca mascara como sincronização concluída.
      return NextResponse.json({
        ok: false,
        fallback: "supabase",
        sheetsWorking: false,
        supabase: "ok",
        recoverable: true,
        processed: 0,
        accepted: 0,
        nextCursor: body?.cursor ?? null,
        hasMore: true,
        elapsedMs: Date.now() - started,
        error: `Google Sheets indisponível: ${sheetError?.message || String(sheetError)}`,
        message: "Lote não enviado à planilha. O Lexis continua operando pelo Supabase.",
      }, { status: 200 });
    }
  } catch (error: any) {
    return jsonError(error?.message || String(error), 500, {
      fallback: "supabase",
    });
  }
}

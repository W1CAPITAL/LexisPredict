/* src/app/api/hybrid/sync/route.ts */
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEFAULT_BATCH = 500;
const MAX_BATCH = 500;
const SHEET_TIMEOUT_MS = 30_000;

type SyncBody = {
  action?: "seed_batch";
  cursor?: string | null;
  batchSize?: number;
};

function env(name: string) {
  return (process.env[name] || "").trim();
}

async function getAuthenticatedUser() {
  const url = env("NEXT_PUBLIC_SUPABASE_URL");
  const anon = env("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  if (!url || !anon) return { user: null, error: "Supabase público não configurado." };

  const cookieStore = await cookies();
  const supabase = createServerClient(url, anon, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(values) {
        try {
          values.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Route handler pode estar em contexto somente leitura.
        }
      },
    },
  });

  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) {
    return { user: null, error: error?.message || "Usuário não autenticado." };
  }
  return { user: data.user, error: null };
}

async function getEmpresaId(userId: string, admin: SupabaseClient) {
  const configured = env("LEXIS_HYBRID_EMPRESA_ID");
  if (configured) return configured;

  const { data, error } = await admin
    .from("profiles")
    .select("empresa_id")
    .eq("auth_user_id", userId)
    .maybeSingle();

  if (error) throw new Error(`Não foi possível identificar a empresa: ${error.message}`);
  if (!data?.empresa_id) throw new Error("Perfil sem empresa_id.");
  return String(data.empresa_id);
}

async function postBatchToSheet(payload: unknown) {
  const webhook = env("LEXIS_SHEETS_WEBHOOK_URL");
  if (!webhook) throw new Error("LEXIS_SHEETS_WEBHOOK_URL não configurada.");

  const token = env("LEXIS_SHEETS_TOKEN");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SHEET_TIMEOUT_MS);

  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "X-Lexis-Mode": "batch",
    };
    if (token) {
      headers.Authorization = `Bearer ${token}`;
      headers["X-Lexis-Token"] = token;
    }

    const response = await fetch(webhook, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
      cache: "no-store",
      signal: controller.signal,
    });

    const raw = await response.text();
    if (!response.ok) {
      throw new Error(`Webhook HTTP ${response.status}: ${raw.slice(0, 500)}`);
    }

    return raw;
  } catch (error: any) {
    if (error?.name === "AbortError") {
      throw new Error("Webhook excedeu o tempo limite.");
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

function buildRows(rows: Record<string, unknown>[]) {
  const preferred = [
    "protocolo",
    "cliente",
    "status",
    "situacao",
    "ultimoRetorno",
    "proximoRetorno",
    "advogado",
    "escritorio",
    "tribunal",
    "telefone",
    "createdBy",
    "atendidoPor",
    "observacao",
    "datajudEncerrado",
    "empresaId",
    "isBaixaTribunal",
  ];

  const allKeys = Array.from(
    new Set(rows.flatMap((row) => Object.keys(row)))
  );

  const headers = [
    ...preferred.filter((key) => allKeys.includes(key)),
    ...allKeys.filter((key) => !preferred.includes(key)),
  ];

  const matrix = rows.map((row) =>
    headers.map((key) => {
      const value = row[key];
      if (value == null) return "";
      if (typeof value === "object") return JSON.stringify(value);
      return String(value);
    })
  );

  return { headers, matrix };
}

export async function GET(req: NextRequest) {
  const mode = req.nextUrl.searchParams.get("mode") || "health";

  const webhook = env("LEXIS_SHEETS_WEBHOOK_URL");
  const url = env("NEXT_PUBLIC_SUPABASE_URL");
  const serviceKey = env("SUPABASE_SERVICE_ROLE_KEY");

  if (mode !== "health") {
    return NextResponse.json({ ok: false, error: "Modo GET inválido." }, { status: 400 });
  }

  const auth = await getAuthenticatedUser();
  if (!auth.user) {
    return NextResponse.json({
      ok: false,
      supabase: "not-configured",
      webhook: webhook ? "ok" : "not-configured",
      error: auth.error || "Não autenticado.",
    }, { status: 401 });
  }

  if (!url) {
    return NextResponse.json({ ok: false, supabase: "not-configured", webhook: webhook ? "ok" : "not-configured" }, { status: 503 });
  }

  const admin = serviceKey ? createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } }) : null;
  const dataClient = admin ?? createClient(url, env("NEXT_PUBLIC_SUPABASE_ANON_KEY"), { auth: { autoRefreshToken: false, persistSession: false } });

  try {
    const empresaId = admin ? await getEmpresaId(auth.user.id, admin) : null;
    const countQuery = dataClient
      .from("processos")
      .select("id", { count: "exact", head: true });

    if (empresaId) countQuery.eq("empresa_id", empresaId);

    const { count, error } = await countQuery;

    return NextResponse.json({
      ok: !error,
      mode: env("LEXIS_HYBRID_MODE") || "sheets_carteira_scan",
      webhook: webhook ? "ok" : "not-configured",
      supabase: error ? "fail" : "ok",
      total: count ?? null,
      empresaId,
      error: error?.message || undefined,
    });
  } catch (error: any) {
    return NextResponse.json({
      ok: false,
      mode: env("LEXIS_HYBRID_MODE") || "sheets_carteira_scan",
      webhook: webhook ? "ok" : "not-configured",
      supabase: "fail",
      error: error?.message || String(error),
    }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const started = Date.now();

  try {
    const body = (await req.json()) as SyncBody;
    if (body.action !== "seed_batch") {
      return NextResponse.json({ ok: false, error: "Ação inválida." }, { status: 400 });
    }

    const auth = await getAuthenticatedUser();
    if (!auth.user) {
      return NextResponse.json({ ok: false, error: auth.error || "Não autenticado." }, { status: 401 });
    }

    const url = env("NEXT_PUBLIC_SUPABASE_URL");
    const serviceKey = env("SUPABASE_SERVICE_ROLE_KEY");
    const anon = env("NEXT_PUBLIC_SUPABASE_ANON_KEY");

    if (!url || (!serviceKey && !anon)) {
      return NextResponse.json({ ok: false, error: "Credenciais do Supabase não configuradas no servidor." }, { status: 503 });
    }

    if (!env("LEXIS_SHEETS_WEBHOOK_URL")) {
      return NextResponse.json({ ok: false, error: "LEXIS_SHEETS_WEBHOOK_URL não configurada." }, { status: 503 });
    }

    const admin = serviceKey
      ? createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } })
      : null;

    const client = admin ?? createClient(url, anon, { auth: { autoRefreshToken: false, persistSession: false } });
    const empresaId = admin ? await getEmpresaId(auth.user.id, admin) : undefined;

    const countBuilder = client.from("processos").select("id", { count: "exact", head: true });
    if (empresaId) countBuilder.eq("empresa_id", empresaId);
    const { count, error: countError } = await countBuilder;
    if (countError) throw new Error(`Contagem da carteira falhou: ${countError.message}`);

    const batchSize = Math.min(
      MAX_BATCH,
      Math.max(1, Number(body.batchSize || DEFAULT_BATCH))
    );

    let query = client
      .from("processos")
      .select("*")
      .order("id", { ascending: true })
      .limit(batchSize);

    if (empresaId) query = query.eq("empresa_id", empresaId);
    if (body.cursor) query = query.gt("id", body.cursor);

    const { data, error } = await query;
    if (error) throw new Error(`Leitura da carteira falhou: ${error.message}`);

    const rows = (data || []) as Record<string, unknown>[];
    const { headers, matrix } = buildRows(rows);
    const nextCursor = rows.length ? String(rows[rows.length - 1].id ?? "") || null : null;
    const hasMore = rows.length === batchSize;

    if (rows.length) {
      await postBatchToSheet({
        action: "upsert_batch",
        source: "lexispredict",
        mode: "sheets_carteira_scan",
        empresa_id: empresaId ?? null,
        batch_size: rows.length,
        headers,
        matrix,
        rows,
        cursor: body.cursor ?? null,
        next_cursor: nextCursor,
        has_more: hasMore,
      });
    }

    return NextResponse.json({
      ok: true,
      total: count ?? 0,
      processed: rows.length,
      accepted: rows.length,
      nextCursor: hasMore ? nextCursor : null,
      hasMore,
      elapsedMs: Date.now() - started,
    });
  } catch (error: any) {
    return NextResponse.json({
      ok: false,
      error: error?.message || String(error),
      elapsedMs: Date.now() - started,
    }, { status: 500 });
  }
}

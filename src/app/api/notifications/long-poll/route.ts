import { NextResponse } from "next/server";
import { getSupabaseAdmin, getUserContext } from "@/lib/server-db";
import { notificationVersion, validNotificationCursor } from "@/lib/notification-long-poll";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const maxDuration = 35;

const HOLD_MS = 22_000;
const CHECK_MS = 4_500;
const MAX_ROWS = 100;
const VERSION_COLUMNS = "id,created_at,updated_at,lida,read_at";
const DETAIL_COLUMNS = "id,tipo,prioridade,titulo,corpo,link,lida,read_at,created_at,updated_at,source,meta,processo_id";

const privateHeaders = {
  "Cache-Control": "private, no-store, no-cache, max-age=0",
  "Vary": "Cookie",
};

function noSession() {
  return NextResponse.json({ ok: false, error: "Sessão não identificada." }, {
    status: 401,
    headers: privateHeaders,
  });
}

async function pause(ms: number, signal: AbortSignal): Promise<void> {
  if (signal.aborted) return;
  await new Promise<void>((resolve) => {
    let timer: ReturnType<typeof setTimeout>;
    const finish = () => {
      clearTimeout(timer);
      signal.removeEventListener("abort", finish);
      resolve();
    };
    timer = setTimeout(finish, ms);
    signal.addEventListener("abort", finish, { once: true });
  });
}

/** Long polling real: espera mudança ou vence após 22s; nunca faz sync/scan
 * e nunca consulta processos inteiros a cada heartbeat. Escopo fixo da sessão.
 */
export async function GET(request: Request) {
  try {
    const ctx = await getUserContext();
    if (!ctx?.auth_id || !ctx?.empresa_id) return noSession();

    const { searchParams } = new URL(request.url);
    const since = validNotificationCursor(searchParams.get("cursor"));
    const db = await getSupabaseAdmin();
    const deadline = Date.now() + HOLD_MS;

    while (!request.signal.aborted) {
      const { data, error } = await db.from("notificacoes")
        .select(VERSION_COLUMNS)
        .eq("empresa_id", ctx.empresa_id)
        .eq("recipient_user_id", ctx.auth_id)
        .order("created_at", { ascending: false })
        .limit(MAX_ROWS);

      if (error) throw error;
      const version = notificationVersion(data || []);
      if (!since || version !== since) {
        const details = await db.from("notificacoes")
          .select(DETAIL_COLUMNS)
          .eq("empresa_id", ctx.empresa_id)
          .eq("recipient_user_id", ctx.auth_id)
          .order("created_at", { ascending: false })
          .limit(MAX_ROWS);
        if (details.error) throw details.error;

        return NextResponse.json({
          ok: true,
          changed: true,
          cursor: notificationVersion(details.data || []),
          notifications: details.data || [],
        }, { headers: privateHeaders });
      }

      if (Date.now() >= deadline) {
        return NextResponse.json({ ok: true, changed: false, cursor: version }, {
          headers: privateHeaders,
        });
      }
      await pause(Math.min(CHECK_MS, deadline - Date.now()), request.signal);
    }

    return new Response(null, { status: 204, headers: privateHeaders });
  } catch (error) {
    console.error("[notification-long-poll] Query failed", error instanceof Error ? error.name : "unknown");
    return NextResponse.json({ ok: false, error: "Atualização temporariamente indisponível." }, {
      status: 503,
      headers: { ...privateHeaders, "Retry-After": "5" },
    });
  }
}

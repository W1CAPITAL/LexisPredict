import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Health check leve — NÃO usa DB pesado.
 * Confirma processo vivo + env críticas + uptime.
 */
export async function GET() {
  const hasSupabase = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY)
  );

  const body = {
    ok: true,
    app: "lexispredict",
    version: process.env.npm_package_version || process.env.NEXT_PUBLIC_APP_VERSION || "unknown",
    supabaseEnv: hasSupabase,
    node: process.version,
    uptimeSec: Math.round(process.uptime()),
    ts: new Date().toISOString(),
  };

  return NextResponse.json(body, {
    status: 200,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}

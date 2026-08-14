import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Health check leve — NÃO usa Drizzle/pg.
 * Confirma que o processo Next está vivo; DB é opcional via env.
 */
export async function GET() {
  const hasSupabase = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY)
  );
  return NextResponse.json({
    ok: true,
    app: "lexispredict",
    supabaseEnv: hasSupabase,
    ts: new Date().toISOString(),
  });
}

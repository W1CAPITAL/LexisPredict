import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin, getUserContext } from "@/lib/server-db";

/**
 * Totais independentes da lista paginada de processos.
 * Somente o contexto autenticado determina empresa e escopo.
 */
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const maxDuration = 15;

const headers = {
  "Cache-Control": "private, no-store, no-cache, must-revalidate, max-age=0",
  "Vary": "Cookie",
  "X-Content-Type-Options": "nosniff",
};

export async function GET(request: NextRequest) {
  try {
    const ctx = await getUserContext();
    if (!ctx.auth_id || !ctx.empresa_id) {
      return NextResponse.json({ ok: false, error: "Sessão expirada" }, { status: 401, headers });
    }
    // A tela Processos da empresa tem escopo empresarial por definição.
    // Fora dela, o usuário não pode forçar escopo ampliado.
    const requested = new URL(request.url).searchParams.get("scope");
    const allCompany = requested === "empresa" || ctx.caseScope === "empresa";
    const db = await getSupabaseAdmin();
    const { data, error } = await db.rpc("lexis_portfolio_snapshot", {
      p_empresa: String(ctx.empresa_id),
      p_owner: allCompany ? null : String(ctx.auth_id),
    });
    if (error || !Array.isArray(data) || !data[0]) {
      console.error("[carteira/indicadores] erro de resumo", error);
      return NextResponse.json(
        { ok: false, error: "Não foi possível consultar os indicadores atuais." },
        { status: 503, headers }
      );
    }
    const row = data[0] as Record<string, unknown>;
    return NextResponse.json({
      ok: true,
      indicadores: {
        total: Number(row.total ?? 0),
        ativos: Number(row.ativos ?? 0),
        encerrados: Number(row.encerrados ?? 0),
        vencidos: Number(row.vencidos ?? 0),
      },
      consultadoEm: new Date().toISOString(),
    }, { headers });
  } catch (error) {
    console.error("[carteira/indicadores]", error);
    return NextResponse.json(
      { ok: false, error: "Falha ao consultar indicadores." },
      { status: 503, headers }
    );
  }
}

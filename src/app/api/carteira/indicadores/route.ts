import { NextRequest, NextResponse } from "next/server";
import { getUserContext } from "@/lib/server-db";
import {getPortfolioSnapshotCached} from "@/lib/portfolio-snapshot";

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
    let row:Record<string,unknown>;
    try {
      row=await getPortfolioSnapshotCached(String(ctx.empresa_id),allCompany?null:String(ctx.auth_id));
    } catch (error) {
      console.error("[carteira/indicadores] resumo indisponível", error instanceof Error?error.message:'unknown');
      return NextResponse.json(
        { ok: false, error: "Não foi possível consultar os indicadores atuais." },
        { status: 503, headers }
      );
    }
    const counts = [row.total, row.ativos, row.encerrados, row.vencidos].map(value =>
      typeof value === 'number' || (typeof value === 'string' && /^\d+$/.test(value)) ? Number(value) : NaN
    );
    if (!counts.every(value => Number.isSafeInteger(value) && value >= 0)) {
      return NextResponse.json(
        { ok: false, error: "O banco retornou indicadores incompletos. Tente novamente." },
        { status: 503, headers }
      );
    }
    const [total, ativos, encerrados, vencidos] = counts;
    return NextResponse.json({
      ok: true,
      indicadores: { total, ativos, encerrados, vencidos },
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

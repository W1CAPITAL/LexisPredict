"use server";

/** KPI de carteira baseado na MESMA função SQL dos indicadores de /processos.
 * Baixa de tribunal não significa encerramento operacional e não pode ser usada
 * para calcular ativos (inclusive quando há cumprimento de sentença).
 */
export type CarteiraCounts = {
  ok: boolean;
  total: number;
  ativos: number;
  encerrados: number;
  empresaId: string | null;
  /** Escopo empresarial é distinto da carteira individual (/cases). */
  isEmpresaWide: boolean;
  error?: string;
};

function unavailable(empresaId: string | null, isEmpresaWide = false, error = "Indicadores indisponíveis."): CarteiraCounts {
  return { ok: false, total: 0, ativos: 0, encerrados: 0, empresaId, isEmpresaWide, error };
}

/** Responsável pessoal é identificado pelo usuário autenticado;
 * a RPC resolve tanto auth_user_id quanto usuarios.id legado.
 */
export async function fetchCarteiraCountsAction(): Promise<CarteiraCounts> {
  try {
    const { getUserContext, getSupabaseAdmin } = await import("@/lib/server-db");
    const ctx = await getUserContext();
    if (!ctx?.empresa_id || !ctx?.auth_id) return unavailable(null, false, "Sessão expirada.");

    const empresaId = String(ctx.empresa_id);
    const isEmpresaWide = Boolean(ctx.isSupervisor || ctx.isSuperAdmin);
    const db = await getSupabaseAdmin();
    const { data, error } = await db.rpc("lexis_portfolio_snapshot", {
      p_empresa: empresaId,
      p_owner: isEmpresaWide ? null : String(ctx.auth_id),
    });
    if (error || !Array.isArray(data) || !data[0]) {
      console.error("[fetchCarteiraCountsAction] snapshot indisponível", error?.message || "vazio");
      return unavailable(empresaId, isEmpresaWide);
    }

    const row = data[0] as Record<string, unknown>;
    const numbers = [row.total, row.ativos, row.encerrados].map(v => Number(v));
    if (!numbers.every(v => Number.isSafeInteger(v) && v >= 0) || numbers[1] + numbers[2] !== numbers[0]) {
      return unavailable(empresaId, isEmpresaWide, "Indicadores inconsistentes no banco.");
    }
    return {
      ok: true,
      total: numbers[0],
      ativos: numbers[1],
      encerrados: numbers[2],
      empresaId,
      isEmpresaWide,
    };
  } catch (e) {
    console.error("[fetchCarteiraCountsAction]", e instanceof Error ? e.message : "Falha");
    return unavailable(null);
  }
}

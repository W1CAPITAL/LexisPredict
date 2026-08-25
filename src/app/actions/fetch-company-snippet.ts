/**
 * SUBSTITUA fetchCompanyProcessosAction em case-actions.ts por isto.
 * Lista inicial limitada (não trava). KPIs via ranking leve + COUNT.
 */
"use server";

export async function fetchCompanyProcessosAction() {
  const {
    getStoredCasesPageForEmpresa,
    getUserContext,
    fetchAuditoriaLogsAction,
    getEmpresaUsers,
  } = await import("@/lib/server-db");

  const empty = {
    cases: [] as any[],
    audit: [] as any[],
    users: [] as any[],
    totalCount: 0,
    ativosCount: 0,
    atendidosSemana: 0,
    ranking: [] as any[],
    error: null as string | null,
  };

  try {
    const ctx = await getUserContext();
    const empresa_id = ctx.empresa_id;
    if (!empresa_id) return empty;

    // 1) Métricas leves + 2) 1ª página da lista + 3) audit/users — em paralelo
    const { fetchRankingAtendentesEmpresaAction } = await import(
      "@/app/actions/ranking-atendentes-action"
    );

    const [metrics, casesPage, audit, users] = await Promise.all([
      fetchRankingAtendentesEmpresaAction(5).catch((e: any) => {
        console.error("[company] metrics", e?.message);
        return { ok: false as const, ranking: [], total: 0, ativos: 0, atendidosSemana: 0 };
      }),
      // 1ª página — 300 linhas (tabela); total vem do COUNT
      getStoredCasesPageForEmpresa(empresa_id, 300, 0, true).catch((e: any) => {
        console.error("[company] page", e?.message);
        return [] as any[];
      }),
      fetchAuditoriaLogsAction(empresa_id).catch(() => []),
      getEmpresaUsers().catch(() => []),
    ]);

    const cases = Array.isArray(casesPage) ? casesPage : [];
    const totalCount =
      metrics && typeof (metrics as any).total === "number" && (metrics as any).total > 0
        ? (metrics as any).total
        : cases.length;
    const ativosCount =
      metrics && typeof (metrics as any).ativos === "number"
        ? (metrics as any).ativos
        : 0;
    const atendidosSemana =
      metrics && typeof (metrics as any).atendidosSemana === "number"
        ? (metrics as any).atendidosSemana
        : 0;
    const ranking =
      metrics && (metrics as any).ok && Array.isArray((metrics as any).ranking)
        ? (metrics as any).ranking
        : [];

    return {
      cases,
      audit: Array.isArray(audit) ? audit : [],
      users: Array.isArray(users) ? users : [],
      totalCount,
      ativosCount,
      atendidosSemana,
      ranking,
      error: null,
    };
  } catch (e: any) {
    console.error("[fetchCompanyProcessosAction] fatal", e?.message);
    return { ...empty, error: e?.message || "falha" };
  }
}

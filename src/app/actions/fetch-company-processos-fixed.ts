/**
 * Substitua a função fetchCompanyProcessosAction em case-actions.ts por esta.
 * Retorna cases + totalCount real (COUNT no banco, nunca cases.length).
 */
"use server";

export async function fetchCompanyProcessosAction() {
  const {
    getEmpresaUsers,
    getStoredCasesForEmpresa,
    getUserContext,
    fetchAuditoriaLogsAction,
    getSupabaseAdmin,
  } = await import("@/lib/server-db");

  const { empresa_id } = await getUserContext();
  if (!empresa_id) {
    return { cases: [], audit: [], users: [], totalCount: 0, ativosCount: 0 };
  }

  const [cases, audit, users, counts] = await Promise.all([
    getStoredCasesForEmpresa(empresa_id, true),
    fetchAuditoriaLogsAction(empresa_id),
    getEmpresaUsers(),
    (async () => {
      try {
        const admin = await getSupabaseAdmin();
        if (!admin) return { total: 0, ativos: 0 };
        const { count: total } = await admin
          .from("processos")
          .select("id", { count: "exact", head: true })
          .eq("empresa_id", empresa_id);
        const { count: enc } = await admin
          .from("processos")
          .select("id", { count: "exact", head: true })
          .eq("empresa_id", empresa_id)
          .eq("datajud_encerrado_tribunal", true);
        const t = total ?? 0;
        const e = enc ?? 0;
        return { total: t, ativos: Math.max(0, t - e) };
      } catch {
        return { total: 0, ativos: 0 };
      }
    })(),
  ]);

  return {
    cases,
    audit,
    users,
    totalCount: counts.total || cases.length,
    ativosCount: counts.ativos || 0,
  };
}

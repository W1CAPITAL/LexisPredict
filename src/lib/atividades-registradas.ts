import { getSupabaseAdmin } from "@/lib/server-db";

/**
 * Conta somente linhas efetivamente salvas em tarefas_realizadas.
 * Não soma registros de auditoria/trabalho analítico nem infere contatos.
 */
export async function getAtividadesRegistradasCount(
  empresaId: string,
  responsavelAuthUserId?: string | null
): Promise<number> {
  if (!empresaId) return 0;
  const db = await getSupabaseAdmin();
  const baseQuery = db
    .from("tarefas_realizadas")
    .select("id", { count: "exact", head: true })
    .eq("empresa_id", empresaId);
  const query = responsavelAuthUserId
    ? baseQuery.eq("responsavel_auth_user_id", responsavelAuthUserId)
    : baseQuery;
  const { count, error } = await query;
  if (error) throw new Error("Falha ao contar atividades registradas: " + error.message);
  return Number(count || 0);
}

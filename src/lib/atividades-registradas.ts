import { getSupabaseAdmin } from "@/lib/server-db";

export type AtividadesResponsavelResumo = {
  registros: number;
  processos: number;
  contatosMarcados: number;
  semReferencia: number;
};

/**
 * Conta somente linhas efetivamente salvas em tarefas_realizadas.
 * Não soma auditorias, ações operacionais ou verificações em lote.
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

/**
 * Resumo histórico por executor. Pagina a origem para não depender do limite
 * padrão do PostgREST e não inclui usuários sem nenhum registro.
 * Processo é deduplicado pelo ID; quando não existe ID, usa o CNJ normalizado.
 */
export async function getAtividadesRegistradasPorResponsavel(
  empresaId: string,
  responsavelAuthUserId?: string | null
): Promise<Record<string, AtividadesResponsavelResumo>> {
  if (!empresaId) return {};
  const db = await getSupabaseAdmin();
  const resumo = new Map<string, AtividadesResponsavelResumo>();
  const processos = new Map<string, Set<string>>();
  const pageSize = 1000;
  let offset = 0;

  while (true) {
    let query = db
      .from("tarefas_realizadas")
      .select("responsavel_auth_user_id,processo_id,protocolo_ref,contato_cliente_confirmado")
      .eq("empresa_id", empresaId);
    if (responsavelAuthUserId) query = query.eq("responsavel_auth_user_id", responsavelAuthUserId);
    const { data, error } = await query
      .order("id", { ascending: true })
      .range(offset, offset + pageSize - 1);

    if (error) throw new Error("Falha ao agrupar atividades por responsável: " + error.message);
    const rows = data || [];
    for (const row of rows) {
      const userId = String(row.responsavel_auth_user_id || "");
      if (!userId) continue;
      const current = resumo.get(userId) || {
        registros: 0,
        processos: 0,
        contatosMarcados: 0,
        semReferencia: 0,
      };
      current.registros += 1;
      if (row.contato_cliente_confirmado) current.contatosMarcados += 1;

      const processId = row.processo_id == null ? "" : String(row.processo_id);
      const cnj = String(row.protocolo_ref || "").replace(/\D/g, "");
      const processKey = processId ? "id:" + processId : cnj ? "cnj:" + cnj : "";
      if (processKey) {
        const seen = processos.get(userId) || new Set<string>();
        seen.add(processKey);
        processos.set(userId, seen);
      } else {
        current.semReferencia += 1;
      }
      resumo.set(userId, current);
    }

    if (rows.length < pageSize) break;
    offset += pageSize;
  }

  for (const [userId, current] of resumo) {
    current.processos = processos.get(userId)?.size || 0;
  }
  return Object.fromEntries(resumo.entries());
}

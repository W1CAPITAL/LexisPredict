/**
 * Substitui o caminho quente de getStoredCasesForEmpresa para listagens.
 * Importar de server-db ou colar a função no lugar da antiga.
 *
 * Diferenças vs legado:
 * - select(colunas leves) em vez de '*'
 * - 1 request com .limit() em vez de loop 500×N
 * - mode priority: ordena por urgência aproximada (updated_at / tem_novo)
 * - teto configurável (default 400)
 */

import { PROCESSOS_LIST_COLUMNS } from "@/lib/carteira-select";
import { CARTEIRA_LIMITS, type CarteiraScopeMode } from "@/lib/carteira-scope";

type AnyClient = {
  from: (t: string) => any;
};

export async function getStoredCasesFast(opts: {
  empresaId: string;
  authId?: string | null;
  mode: CarteiraScopeMode;
  limit?: number;
  client: AnyClient;
  toLegalCase: (row: any) => any;
}): Promise<any[]> {
  const { empresaId, authId, mode, client, toLegalCase } = opts;
  if (!empresaId || !client) return [];

  const limit = Math.min(
    opts.limit ?? (mode === "company" ? CARTEIRA_LIMITS.hardMax : CARTEIRA_LIMITS.tarefas),
    CARTEIRA_LIMITS.hardMax
  );

  let query = client
    .from("processos")
    .select(PROCESSOS_LIST_COLUMNS)
    .eq("empresa_id", empresaId)
    .order("updated_at", { ascending: false, nullsFirst: false })
    .limit(limit);

  if (mode === "mine" && authId) {
    query = query.or(`created_by.eq.${authId},atendido_por.eq.${authId}`);
  }
  // priority e company: sem filtro de dono (mas limitados)

  const { data, error } = await query;
  if (error) {
    console.error("[getStoredCasesFast]", error.message || error);
    // fallback mine_or_orphan
    if (mode === "mine" && authId) {
      const q2 = client
        .from("processos")
        .select(PROCESSOS_LIST_COLUMNS)
        .eq("empresa_id", empresaId)
        .or(`created_by.eq.${authId},atendido_por.eq.${authId},created_by.is.null`)
        .order("updated_at", { ascending: false })
        .limit(limit);
      const r2 = await q2;
      if (r2.error) throw r2.error;
      return (r2.data || []).map((item: any) => {
        try {
          return toLegalCase(item);
        } catch {
          return null;
        }
      }).filter(Boolean);
    }
    throw error;
  }

  return (data || [])
    .map((item: any) => {
      try {
        return toLegalCase(item);
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

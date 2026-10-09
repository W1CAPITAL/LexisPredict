import type { getUserContext } from '@/lib/server-db';

type Context = Awaited<ReturnType<typeof getUserContext>>;

/**
 * Edição e atendimento operacionais valem para todo usuário autenticado da
 * mesma empresa, independentemente do responsável da carteira.
 * Nunca permite acesso a outra empresa; transferências e exclusões têm ACL própria.
 */
export async function canAccessExistingCase(ctx: Context, row: Record<string, any> | null): Promise<boolean> {
  if (!row || !ctx.auth_id || !ctx.empresa_id) return false;
  return String(row.empresa_id || '') === String(ctx.empresa_id);
}

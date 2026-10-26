import type { getUserContext } from '@/lib/server-db';
import { canOperateCompanyCases } from '@/lib/roles';

type Context = Awaited<ReturnType<typeof getUserContext>>;

/**
 * Edição e atendimento operacionais valem para todo usuário autenticado da
 * mesma empresa, independentemente do responsável da carteira.
 * Edição, atendimento e exclusão de processos são colaborativos dentro da empresa.
 * O servidor deve sempre validar a empresa, inclusive ao usar service_role.
 */
export async function canAccessExistingCase(ctx: Context, row: Record<string, any> | null): Promise<boolean> {
  if (!row || !canOperateCompanyCases(ctx)) return false;
  return String(row.empresa_id || '') === String(ctx.empresa_id);
}

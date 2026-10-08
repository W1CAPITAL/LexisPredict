import type { getUserContext } from '@/lib/server-db';
import { resolveCaseScope, resolveRole } from '@/lib/roles';
import { isCasoEncerrado } from '@/lib/status-encerrado';

type Context = Awaited<ReturnType<typeof getUserContext>>;

/**
 * Escopo operacional por empresa: a supervisão atende toda a carteira;
 * Administradores podem regularizar inclusive processos encerrados e sem dono
 * da própria empresa. Operadores continuam limitados ao próprio responsável.
 */
export async function canAccessExistingCase(ctx: Context, row: Record<string, any> | null): Promise<boolean> {
  if (!row || !ctx.auth_id || !ctx.empresa_id || ctx.isViewer) return false;
  if (String(row.empresa_id || '') !== String(ctx.empresa_id)) return false;
  if (resolveCaseScope(ctx as any) === 'empresa') return true;
  if (resolveRole({ cargo: ctx.cargo }) === 'Administrador' && isCasoEncerrado(row)) return true;
  const owner = String(row.created_by || row.dados?.created_by || '').trim();
  return !!owner && owner === String(ctx.auth_id);
}

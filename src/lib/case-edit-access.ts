import type { getUserContext } from '@/lib/server-db';
import { resolveCaseScope } from '@/lib/roles';

type Context = Awaited<ReturnType<typeof getUserContext>>;

/** Somente o próprio responsável ou a supervisão pode alterar o processo. */
export async function canAccessExistingCase(ctx: Context, row: Record<string, any> | null): Promise<boolean> {
  if (!row || !ctx.auth_id || !ctx.empresa_id || ctx.isViewer) return false;
  if (String(row.empresa_id || '') !== String(ctx.empresa_id)) return false;
  if (resolveCaseScope(ctx as any) === 'empresa') return true;
  const owner = String(row.created_by || row.dados?.created_by || '').trim();
  return !!owner && owner === String(ctx.auth_id);
}

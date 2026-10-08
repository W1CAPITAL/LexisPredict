import { getSupabaseAdmin, type getUserContext } from '@/lib/server-db';
import { resolveRole, resolveCaseScope } from '@/lib/roles';

type Context = Awaited<ReturnType<typeof getUserContext>>;

/** Trust the persisted process owner and authenticated tenant, never the client payload. */
export async function canAccessExistingCase(ctx: Context, row: Record<string, any> | null): Promise<boolean> {
  if (!row || !ctx.auth_id || !ctx.empresa_id || ctx.isViewer) return false;
  if (String(row.empresa_id || '') !== String(ctx.empresa_id)) return false;
  if (resolveCaseScope(ctx as any) === 'empresa') return true;
  const owner = String(row.created_by || row.dados?.created_by || '').trim();
  if (owner === String(ctx.auth_id)) return true;
  if (resolveRole(ctx as any) !== 'Administrador' || !owner) return false;
  // Administrador can maintain imported legacy cases with deleted owners,
  // but never cases belonging to an existing user, even in another company.
  const db = await getSupabaseAdmin();
  const { data, error } = await db.from('usuarios').select('auth_user_id')
    .eq('auth_user_id', owner).limit(1);
  return !error && Array.isArray(data) && data.length === 0;
}

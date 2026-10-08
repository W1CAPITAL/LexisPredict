/**
 * Single server-side authorization for editing a persisted process.
 * Never trust the client-submitted created_by field.
 */
import { getSupabaseAdmin } from '@/lib/server-db';
import type { getUserContext } from '@/lib/server-db';
import { resolveCaseScope, resolveRole } from '@/lib/roles';

type Context = Awaited<ReturnType<typeof getUserContext>>;

export async function canAccessExistingCase(ctx: Context, row: Record<string, any> | null): Promise<boolean> {
  if (!row) return true;
  if (!ctx.empresa_id || (row.empresa_id && String(row.empresa_id) !== String(ctx.empresa_id))) return false;
  if (!ctx.auth_id || ctx.isViewer) return false;
  const role = resolveRole(ctx as any);
  if (role === 'Visualizador' || role === 'Desconhecido') return false;
  if (resolveCaseScope(ctx as any) === 'empresa') return true;
  const owner = String(row.created_by || row.dados?.created_by || '').trim();
  if (owner === String(ctx.auth_id)) return true;
  if (role !== 'Administrador' || !owner) return false;
  // Older imported cases may point at deleted accounts. Only administrators
  // may maintain them, and only when that owner does not exist in ANY tenant.
  const admin = await getSupabaseAdmin();
  const { data, error } = await admin.from('usuarios').select('auth_user_id')
    .eq('auth_user_id', owner).limit(1);
  return !error && Array.isArray(data) && data.length === 0;
}

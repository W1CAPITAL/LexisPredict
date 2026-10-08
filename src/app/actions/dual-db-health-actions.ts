'use server';

import { getUserContext } from '@/lib/server-db';
import { getWaReadClients, isDualDbEnabled } from '@/lib/dual-db-routing';

/** Superadmin-only diagnostics. No keys, URLs or user rows leave the server. */
export async function getDualDbHealthAction() {
  const ctx = await getUserContext();
  if (!ctx.isSuperAdmin) return { ok: false as const, error: 'Sem permissão' };
  try {
    const results = await Promise.all(getWaReadClients().map(async ({ shard, client }) => {
      const started = Date.now();
      const { count, error } = await client
        .from('whatsapp_messages')
        .select('id', { head: true, count: 'exact' });
      return { shard, ok: !error, rows: count ?? null, latencyMs: Date.now() - started, error: error?.message || null };
    }));
    return {
      ok: results.every(r => r.ok),
      mode: isDualDbEnabled() ? 'sharded' : 'primary',
      // Row counts are not byte size or actual query load.
      databases: results,
    };
  } catch (e: any) {
    return { ok: false as const, error: e?.message || 'Configuração incompleta' };
  }
}

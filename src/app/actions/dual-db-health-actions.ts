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
      // Independent count queries start together; a slow shard doesn't delay
      // the launch of the other shard. Never expose credentials or row content.
      const tableNames = ['whatsapp_messages', 'scan_metrics', 'alert_events'] as const;
      const tables = await Promise.all(tableNames.map(async table => {
        const t0 = Date.now();
        const { count, error } = await client.from(table)
          .select('id', { head: true, count: 'exact' });
        return { table, rows: count ?? null, latencyMs: Date.now() - t0, ok: !error, error: error?.message || null };
      }));
      return { shard, ok: tables.every(t => t.ok), latencyMs: Date.now() - started, tables };
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

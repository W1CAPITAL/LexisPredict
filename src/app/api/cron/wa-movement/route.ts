import { NextResponse } from 'next/server';
import { timingSafeEqual } from 'node:crypto';
import { getSupabaseAdmin } from '@/lib/server-db';
import { queueNextMovementForTenant } from '@/lib/wa-movement-campaign';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;
const noStore = { 'Cache-Control': 'private, no-store' };

function authenticated(request: Request) {
  const token = String(request.headers.get('authorization') || '')
    .replace(/^Bearer\s+/i, '').trim();
  // Support the Supabase vault cron token and the platform's CRON_SECRET.
  return [process.env.WA_MOVEMENT_CRON_SECRET, process.env.CRON_SECRET]
    .filter((s): s is string => typeof s === 'string' && s.length >= 16)
    .some((s) => token.length === s.length &&
      timingSafeEqual(Buffer.from(token), Buffer.from(s)));
}

/**
 * Background scheduler independent of UI tabs, user location and browser sessions.
 * Only authenticated server-side workers can prepare a job.
 * The connected device worker still performs the actual send and acknowledges it.
 * Atomic reservations enforce the minimum gap, opt-outs and daily limits.
 */
export async function GET(request: Request) {
  if (!authenticated(request)) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401, headers: noStore });
  }
  try {
    const db = await getSupabaseAdmin();
    const { data: configs, error } = await db.from('wa_daily_return_settings')
      .select('empresa_id')
      .eq('enabled', true)
      .eq('consent_attested', true)
      .limit(25);
    if (error) return NextResponse.json({ ok: false, error: 'Configuração indisponível' },
      { status: 503, headers: noStore });
    const results: Array<{ tenant: string; queued: boolean; reason: string }> = [];
    const started = Date.now();
    for (const cfg of configs || []) {
      if (Date.now() - started > 40000) break;
      try {
        const next = await queueNextMovementForTenant(cfg.empresa_id);
        results.push({
          tenant: cfg.empresa_id,
          queued: next.queued === true,
          reason: 'reason' in next ? String(next.reason) : 'processed',
        });
      } catch (e) {
        console.error('[wa-movement-cron] preparation failed',
          e instanceof Error ? e.message : 'unknown');
        results.push({ tenant: cfg.empresa_id, queued: false, reason: 'preparation_failed' });
      }
    }
    return NextResponse.json({
      ok: true,
      queued: results.filter((x) => x.queued).length,
      checked: results.length,
      reasons: results.map((x) => x.reason),
    }, { headers: noStore });
  } catch (e) {
    console.error('[wa-movement-cron] fatal', e instanceof Error ? e.message : 'unknown');
    return NextResponse.json({ ok: false, error: 'Erro ao preparar comunicados' },
      { status: 503, headers: noStore });
  }
}

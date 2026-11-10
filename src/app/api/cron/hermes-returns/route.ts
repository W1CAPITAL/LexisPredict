import { NextResponse } from 'next/server';
import { timingSafeEqual } from 'node:crypto';
import { runHermesDueReviewBatch } from '@/lib/hermes-return-service';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

function authorized(request: Request): boolean {
  const token = String(request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim();
  return [process.env.WA_DAILY_CRON_SECRET, process.env.CRON_SECRET]
    .filter((value): value is string => typeof value === 'string' && value.length >= 20)
    .some((secret) => token.length === secret.length &&
      timingSafeEqual(Buffer.from(token), Buffer.from(secret)));
}

/** No messages are sent here. Periodic judicial checks populate a private review queue. */
export async function GET(request: Request) {
  if (!authorized(request)) return NextResponse.json(
    { ok: false, error: 'Unauthorized' }, { status: 401, headers: { 'Cache-Control': 'no-store' } },
  );
  try {
    const result = await runHermesDueReviewBatch(2);
    return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('[Hermes Returns] scheduler error', error instanceof Error ? error.message : 'unknown');
    return NextResponse.json({ ok: false, error: 'O scanner de retornos está indisponível.' },
      { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }
}

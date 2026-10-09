/**
 * @fileOverview Trigger assíncrono — dispara worker BOTH (substitui Cron no Hobby)
 */
import { NextResponse } from 'next/server';
import { getUserContext } from '@/lib/server-db';
import { runCloudScanBatch } from '@/lib/cloud-scan-batch';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const { empresa_id } = await getUserContext();
    if (!empresa_id) return new Response('Unauthorized', { status: 401 });

    let mode = 'both';
    let scope = 'full';
    let since: string | null = null;
    let afterId = 0;
    try {
      const body = await request.clone().json().catch(() => ({}));
      if (body?.mode && ['datajud', 'djen', 'both'].includes(body.mode)) mode = body.mode;
      if (body?.scope && ['full', 'cumprimento'].includes(body.scope)) scope = body.scope;
      if (body?.since) since = String(body.since);
      if (Number.isSafeInteger(body?.afterId) && body.afterId >= 0) afterId = body.afterId;
    } catch {
      /* ignore */
    }

    const worker = await runCloudScanBatch({
      empresaId: String(empresa_id),
      mode: mode as 'datajud' | 'djen' | 'both',
      scope: scope as 'full' | 'cumprimento',
      since,
      afterId,
    });

    return NextResponse.json({ started: true, mode, scope, since, worker });
  } catch (error: any) {
    return NextResponse.json({ started: false, error: error.message }, { status: 500 });
  }
}

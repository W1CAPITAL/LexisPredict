/**
 * Worker DataJud/DJEN — lote sequencial (1 a 1) para reduzir "Tempo esgotado"
 * @copyright 2026 Davi Alves Figueredo / W1 Capital Assessoria Financeira Ltda.
 */
import { NextResponse } from 'next/server';
import { runCloudScanBatch } from '@/lib/cloud-scan-batch';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(request: Request) {
  const { searchParams } = new URL(request.url);
  const empresa_id = searchParams.get('empresa_id');
  let mode = (searchParams.get('mode') as 'datajud' | 'djen' | 'both') || 'both';
  if (!['datajud', 'djen', 'both'].includes(mode)) mode = 'both';
  let scope = (searchParams.get('scope') as 'full' | 'cumprimento') || 'full';
  if (!['full', 'cumprimento'].includes(scope)) scope = 'full';
  let since = searchParams.get('since');

  try {
    const body = await request.clone().json().catch(() => ({}));
    if (body?.mode && ['datajud', 'djen', 'both'].includes(body.mode)) mode = body.mode;
    if (body?.scope && ['full', 'cumprimento'].includes(body.scope)) scope = body.scope;
    if (body?.since) since = String(body.since);
  } catch {
    /* ignore */
  }

  const authHeader = request.headers.get('Authorization');
  const workerSecret = process.env.DATAJUD_WORKER_SECRET;

  if (!workerSecret || authHeader !== `Bearer ${workerSecret}`) {
    return new Response('Unauthorized', { status: 401 });
  }
  if (!empresa_id) {
    return new Response('Bad Request: empresa_id is required', { status: 400 });
  }

  console.log(`[Omni Worker] Empresa ${empresa_id} mode=${mode} scope=${scope} since=${since || '-'} sequential`);

  try {
    const result = await runCloudScanBatch({
      empresaId: String(empresa_id),
      mode,
      scope,
      since,
    });

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('[Omni Worker] Critical:', error.message);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

/**
 * @fileOverview Worker DataJud/DJEN — SYSTEM + Bearer
 * @copyright 2026 Davi Alves Figueredo / W1 Capital Assessoria Financeira Ltda.
 */
import { NextResponse } from 'next/server';
import { getGlobalPendingProcessesSystem } from '@/lib/server-db';
import { auditCaseCoreSystem } from '@/app/actions/case-actions';

export const dynamic = 'force-dynamic';

const BATCH_SIZE = 5;
const CONCURRENCY = 2;
const MAX_RUNTIME_MS = 50000;

export async function POST(request: Request) {
  const { searchParams } = new URL(request.url);
  const empresa_id = searchParams.get('empresa_id');
  let mode = (searchParams.get('mode') as 'datajud' | 'djen' | 'both') || 'both';
  if (!['datajud', 'djen', 'both'].includes(mode)) mode = 'both';

  try {
    const body = await request.clone().json().catch(() => ({}));
    if (body?.mode && ['datajud', 'djen', 'both'].includes(body.mode)) mode = body.mode;
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

  const start = Date.now();
  console.log(`[Omni Worker] Empresa ${empresa_id} mode=${mode}`);

  try {
    const casesToAudit = await getGlobalPendingProcessesSystem(BATCH_SIZE, empresa_id);
    if (casesToAudit.length === 0) {
      return NextResponse.json({ success: true, processed: 0, message: 'Fila limpa.' });
    }

    let successCount = 0;
    let failedCount = 0;

    for (let i = 0; i < casesToAudit.length; i += CONCURRENCY) {
      if (Date.now() - start > MAX_RUNTIME_MS) break;
      const chunk = casesToAudit.slice(i, i + CONCURRENCY);
      await Promise.all(
        chunk.map(async (c) => {
          try {
            const res = await auditCaseCoreSystem(c.protocolo, empresa_id, mode, { fast: true });
            if (res.success) successCount++;
            else failedCount++;
          } catch (err) {
            console.error(`[Worker Fail] ${c.protocolo}:`, err);
            failedCount++;
          }
        })
      );
    }

    return NextResponse.json({
      success: true,
      processed: successCount + failedCount,
      successCount,
      failedCount,
      duration: `${Date.now() - start}ms`,
    });
  } catch (error: any) {
    console.error('[Omni Worker] Critical:', error.message);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

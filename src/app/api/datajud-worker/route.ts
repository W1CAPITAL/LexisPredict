/**
 * @fileOverview Worker DataJud/DJEN — prioriza tribunal (não só DJEN rápido)
 * @copyright 2026 Davi Alves Figueredo / W1 Capital Assessoria Financeira Ltda.
 */
import { NextResponse } from 'next/server';
import { getGlobalPendingProcessesSystem } from '@/lib/server-db';
import { auditCaseCoreSystem } from '@/app/actions/case-actions';

export const dynamic = 'force-dynamic';
export const preferredRegion = 'gru1';
export const maxDuration = 60;

// Lote menor + sequencial: DataJud precisa de tempo; paralelismo matava o tribunal
const BATCH_SIZE = 4;
const MAX_RUNTIME_MS = 55000;

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
    let datajudOkCount = 0;
    let djenOkCount = 0;

    // SEQUENCIAL (1 a 1): evita 2 DataJud juntos estourarem timeout
    for (const c of casesToAudit) {
      if (Date.now() - start > MAX_RUNTIME_MS) break;
      try {
        // fast:true usa timeout 28s+retry no datajud.ts novo — não pular tribunal
        const res = await auditCaseCoreSystem(c.protocolo, empresa_id, mode, { fast: true });
        if (res.success) {
          successCount++;
          const patch = (res as any).casePatch || {};
          if (patch.datajud_consultado_em) datajudOkCount++;
          if (patch.djen_consultado_em) djenOkCount++;
        } else {
          failedCount++;
        }
      } catch (err) {
        console.error(`[Worker Fail] ${c.protocolo}:`, err);
        failedCount++;
      }
    }

    return NextResponse.json({
      success: true,
      processed: successCount + failedCount,
      successCount,
      failedCount,
      datajudOkCount,
      djenOkCount,
      mode,
      duration: `${Date.now() - start}ms`,
    });
  } catch (error: any) {
    console.error('[Omni Worker] Critical:', error.message);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

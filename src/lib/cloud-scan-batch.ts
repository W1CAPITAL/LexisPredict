import 'server-only';

import { getGlobalPendingProcessesSystem } from '@/lib/server-db';
import { auditCaseCoreSystem } from '@/app/actions/case-actions';

export type CloudScanMode = 'datajud' | 'djen' | 'both';
export type CloudScanScope = 'full' | 'cumprimento';

// Three CNJs per invocation, concurrently. Official-source timeouts remain bounded.
const BATCH_SIZE = 3;

export async function runCloudScanBatch(input: {
  empresaId: string;
  mode: CloudScanMode;
  scope: CloudScanScope;
  since?: string | null;
  afterId?: string | null;
}) {
  const startedAt = Date.now();
  const casesToAudit = await getGlobalPendingProcessesSystem(BATCH_SIZE, input.empresaId, {
    scope: input.scope,
    mode: input.mode,
    since: input.since || null,
    afterId: input.afterId || null,
  });

  if (!Array.isArray(casesToAudit)) throw new Error('O Supabase não confirmou a fila do scanner.');

  if (casesToAudit.length === 0) {
    return {
      success: true, processed: 0, successCount: 0, failedCount: 0, partialCount: 0,
      mode: input.mode, scope: input.scope, since: input.since || null,
      durationMs: Date.now() - startedAt, lastId: input.afterId || null,
      caseResults: [], message: 'Fila da sessão concluída.',
    };
  }

  // The queue is ordered by database ID. Advance only to the last selected row.
  const lastItem = casesToAudit[casesToAudit.length - 1] as any;
  const lastId = String(lastItem?.db_id || lastItem?.id || input.afterId || '').trim() || input.afterId || null;

  const caseResults = await Promise.all(casesToAudit.map(async (item: any) => {
    const itemStartedAt = Date.now();
    try {
      const result = await auditCaseCoreSystem(item.protocolo, input.empresaId, input.mode, {
        fast: true, cloudBudget: true, useClaudeAi: false,
      });
      const success = result.success === true && !(result as any).offline;
      const datajudOk = result.sourceStatus?.datajud?.ok === true;
      const djenOk = result.sourceStatus?.djen?.ok === true;
      const datajudSource = result.sourceStatus?.datajud;
      const djenSource = result.sourceStatus?.djen;
      const datajudError = typeof datajudSource?.error === 'string' ? datajudSource.error : null;
      const djenError = typeof djenSource?.error === 'string' ? djenSource.error : null;
      return {
        cnj: String(item.protocolo || ''), success, durationMs: Date.now() - itemStartedAt,
        datajudOk, djenOk,
        ...(!datajudOk && datajudError ? { datajudError: datajudError.slice(0, 120) } : {}),
        ...(!djenOk && djenError ? { djenError: djenError.slice(0, 120) } : {}),
        ...(!success ? {
          error: ([datajudError, djenError].filter(Boolean).join(' · ') ||
            String((result as any).error || 'Nenhuma consulta oficial confirmada neste lote')).slice(0, 180),
        } : {}),
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Falha no tribunal';
      console.error('[CloudScanBatch] case failed', item.protocolo, error);
      return {
        cnj: String(item.protocolo || ''), success: false, durationMs: Date.now() - itemStartedAt,
        datajudOk: false, djenOk: false, error: message.slice(0, 180),
      };
    }
  }));

  const successCount = caseResults.filter(item => item.success).length;
  const failedCount = caseResults.filter(item => !item.success).length;
  const partialCount = caseResults.filter(item =>
    item.success && input.mode === 'both' && (!item.datajudOk || !item.djenOk)
  ).length;

  return {
    success: failedCount === 0 && successCount > 0,
    processed: caseResults.length, successCount, failedCount, partialCount, lastId, caseResults,
    mode: input.mode, scope: input.scope, since: input.since || null,
    durationMs: Date.now() - startedAt,
  };
}

import 'server-only';

import { getGlobalPendingProcessesSystem } from '@/lib/server-db';
import { auditCaseCoreSystem } from '@/app/actions/case-actions';

export type CloudScanMode = 'datajud' | 'djen' | 'both';
export type CloudScanScope = 'full' | 'cumprimento';

// Vercel has a 60s max invocation. Use one bounded CNJ per request;
 // the browser periodically dispatches the next batch.
const BATCH_SIZE = 3;
const MAX_RUNTIME_MS = 38_000;
const DELAY_BETWEEN_MS = 0;

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function runCloudScanBatch(input: {
  empresaId: string;
  mode: CloudScanMode;
  scope: CloudScanScope;
  since?: string | null;
  afterId?: string | null;
}) {
  const startedAt = Date.now();

  const casesToAudit = await getGlobalPendingProcessesSystem(
    BATCH_SIZE,
    input.empresaId,
    {
      scope: input.scope,
      mode: input.mode,
      since: input.since || null,
      afterId: input.afterId || null,
    }
  );

  if (casesToAudit.length === 0) {
    return {
      success: true,
      processed: 0,
      successCount: 0,
      failedCount: 0,
      mode: input.mode,
      scope: input.scope,
      since: input.since || null,
      durationMs: Date.now() - startedAt,
      lastId: input.afterId || null,
      message: 'Fila da sessão concluída.',
    };
  }

  let successCount = 0;
  let failedCount = 0;
  let lastId = input.afterId || null;

  for (let i = 0; i < casesToAudit.length; i++) {
    if (Date.now() - startedAt > MAX_RUNTIME_MS) break;

    const item = casesToAudit[i];
    const itemId = String((item as any).db_id || item.id || '').trim();
    if (itemId) lastId = itemId;

    try {
      const result = await auditCaseCoreSystem(
        item.protocolo,
        input.empresaId,
        input.mode,
        { fast: true, cloudBudget: true, useClaudeAi: false }
      );

      if (result.success && !(result as any).offline) successCount += 1;
      else failedCount += 1;
    } catch (error) {
      console.error('[CloudScanBatch] case failed', item.protocolo, error);
      failedCount += 1;
    }

    if (i < casesToAudit.length - 1) {
      await sleep(DELAY_BETWEEN_MS);
    }
  }

  return {
    success: true,
    processed: successCount + failedCount,
    successCount,
    failedCount,
    lastId,
    mode: input.mode,
    scope: input.scope,
    since: input.since || null,
    durationMs: Date.now() - startedAt,
  };
}

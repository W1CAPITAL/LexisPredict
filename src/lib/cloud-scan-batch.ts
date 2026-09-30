import 'server-only';

import { getGlobalPendingProcessesSystem } from '@/lib/server-db';
import { auditCaseCoreSystem } from '@/app/actions/case-actions';

export type CloudScanMode = 'datajud' | 'djen' | 'both';
export type CloudScanScope = 'full' | 'cumprimento';

// Processa vários CNJs por invocação e ainda respeita o orçamento de 52s abaixo.
const BATCH_SIZE = 24;
const MAX_RUNTIME_MS = 52_000;
const DELAY_BETWEEN_MS = 400;

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function runCloudScanBatch(input: {
  empresaId: string;
  mode: CloudScanMode;
  scope: CloudScanScope;
  since?: string | null;
}) {
  const startedAt = Date.now();

  const casesToAudit = await getGlobalPendingProcessesSystem(
    BATCH_SIZE,
    input.empresaId,
    {
      scope: input.scope,
      mode: input.mode,
      since: input.since || null,
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
      message: 'Fila da sessão concluída.',
    };
  }

  let successCount = 0;
  let failedCount = 0;

  for (let i = 0; i < casesToAudit.length; i++) {
    if (Date.now() - startedAt > MAX_RUNTIME_MS) break;

    const item = casesToAudit[i];

    try {
      const result = await auditCaseCoreSystem(
        item.protocolo,
        input.empresaId,
        input.mode,
        { fast: true }
      );

      if (result.success) successCount += 1;
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
    mode: input.mode,
    scope: input.scope,
    since: input.since || null,
    durationMs: Date.now() - startedAt,
  };
}

/**
 * Contrato M/N da planilha W1 (último retorno / próximo retorno).
 * Fila em memória + webhook opcional (SHEETS_PUSH_WEBHOOK_URL).
 * Não bloqueia o save do CRM se o push falhar.
 */

export type SheetMnPayload = {
  protocolo: string;
  ultimoRetorno?: string | null;
  proximoPrazo?: string | null;
  empresa_id?: string | null;
  via?: string;
};

const MAX_BATCH = 50;
const queue: SheetMnPayload[] = [];
const missing: SheetMnPayload[] = [];

export function enqueueSheetMnPush(item: SheetMnPayload) {
  if (!item?.protocolo) return;
  queue.push(item);
}

export function peekSheetMnQueue() {
  return { pending: queue.length, missing: missing.length };
}

export function drainSheetMnBatch(size = MAX_BATCH): SheetMnPayload[] {
  return queue.splice(0, Math.max(1, Math.min(size, MAX_BATCH)));
}

export async function flushSheetMnPush(items?: SheetMnPayload[]): Promise<{
  ok: number;
  failed: number;
  skipped: boolean;
}> {
  const batch = items || drainSheetMnBatch();
  if (!batch.length) return { ok: 0, failed: 0, skipped: true };

  const url = (typeof process !== 'undefined' && process.env.SHEETS_PUSH_WEBHOOK_URL) || '';
  if (!url) {
    missing.push(...batch);
    return { ok: 0, failed: 0, skipped: true };
  }

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rows: batch, contract: 'W1-MN' }),
    });
    if (!res.ok) {
      missing.push(...batch);
      return { ok: 0, failed: batch.length, skipped: false };
    }
    return { ok: batch.length, failed: 0, skipped: false };
  } catch {
    missing.push(...batch);
    return { ok: 0, failed: batch.length, skipped: false };
  }
}

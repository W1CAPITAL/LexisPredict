/**
 * Fila de scan persistente (paridade offline: pending no disco).
 * Sobrevive a fechar a aba; o scanner retoma os CNJs restantes.
 */

const KEY = 'lexis_scan_queue_v1';

export type PersistedScanQueue = {
  protocolos: string[];
  cursor: number;
  mode: 'datajud' | 'djen' | 'both';
  updatedAt: string;
};

export function loadScanQueue(): PersistedScanQueue | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PersistedScanQueue;
    if (!Array.isArray(parsed?.protocolos)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveScanQueue(q: PersistedScanQueue) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify({ ...q, updatedAt: new Date().toISOString() }));
  } catch {
    /* quota */
  }
}

export function clearScanQueue() {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    /* */
  }
}

export function remainingProtocolos(q: PersistedScanQueue | null): string[] {
  if (!q?.protocolos?.length) return [];
  return q.protocolos.slice(Math.max(0, q.cursor || 0));
}

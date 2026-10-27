/**
 * Recuperação limitada de fontes pendentes no scanner de nuvem.
 * Um sucesso DJEN nunca equivale a confirmação DataJud em modo BOTH.
 */
export type CloudSourceResult = {
  datajudError?: string | null;
  djenError?: string | null;
  error?: string | null;
};

export function shouldRetryPendingCloudSources(input: {
  processed: number;
  pending: number | null;
  retryPass: number;
}): boolean {
  // Só no esgotamento real da fila, e no máximo uma passagem extra.
  return input.processed === 0 &&
    input.pending !== null &&
    Number.isFinite(input.pending) &&
    input.pending > 0 &&
    input.retryPass < 1;
}

export function cloudSourceCooldownMs(items: readonly CloudSourceResult[]): number {
  const errors = items.map((item) => `${item.datajudError || ''} ${item.djenError || ''} ${item.error || ''}`).join(' ').toLowerCase();
  // Respeitar o limite do tribunal em vez de fazer outra consulta 5s depois.
  if (/429|rate.limit|limite de consultas|pediu pausa/.test(errors)) return 45_000;
  if (/shard|instável|503|502/.test(errors)) return 15_000;
  if (/tempo esgotado|timeout/.test(errors)) return 7_000;
  return 0;
}

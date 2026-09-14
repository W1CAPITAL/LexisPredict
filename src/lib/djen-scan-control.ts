export function splitDjenDateRange(start: string, end: string, days = 30) {
  const parse = (value: string) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error('Informe datas válidas.');
    const time = Date.parse(`${value}T00:00:00Z`);
    if (!Number.isFinite(time) || new Date(time).toISOString().slice(0, 10) !== value) throw new Error('Informe datas válidas.');
    return time;
  };
  const first = parse(start);
  let last = parse(end);
  if (first > last) throw new Error('A data inicial precisa ser anterior à data final.');
  if (!Number.isInteger(days) || days < 1 || days > 90) throw new Error('Janela de consulta inválida.');
  const day = 86_400_000;
  const windows: Array<{ inicio: string; fim: string }> = [];
  while (last >= first) {
    const begin = Math.max(first, last - (days - 1) * day);
    windows.push({ inicio: new Date(begin).toISOString().slice(0, 10), fim: new Date(last).toISOString().slice(0, 10) });
    last = begin - day;
  }
  return windows;
}

export function djenRetryDelay(attempt: number, retryAfter?: string | null, now = Date.now()) {
  const numeric = retryAfter ? Number(retryAfter) : NaN;
  const seconds = Number.isFinite(numeric) ? numeric : retryAfter ? (Date.parse(retryAfter) - now) / 1000 : 0;
  return Math.max(5000 * 2 ** Math.min(Math.max(attempt, 0), 4), Number.isFinite(seconds) ? Math.max(0, seconds) * 1000 : 0);
}

export async function waitForDjen(ms: number, signal: AbortSignal) {
  if (signal.aborted) throw new DOMException('Consulta interrompida.', 'AbortError');
  return new Promise<void>((resolve, reject) => {
    const abort = () => { clearTimeout(timer); signal.removeEventListener('abort', abort); reject(new DOMException('Consulta interrompida.', 'AbortError')); };
    const timer = setTimeout(() => { signal.removeEventListener('abort', abort); resolve(); }, ms);
    signal.addEventListener('abort', abort, { once: true });
  });
}

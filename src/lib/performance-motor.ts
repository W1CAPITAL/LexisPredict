/**
 * Motor de Desempenho LexisPredict
 * Cache em memória, pool de concorrência e medição de latência.
 * Não altera regra de negócio — só acelera leituras repetidas e lotes.
 */

type CacheEntry<T> = { value: T; expires: number };

const store = new Map<string, CacheEntry<unknown>>();
const inflight = new Map<string, Promise<unknown>>();

const DEFAULT_TTL_MS = 90_000; // 90s — cadastro + scanner no mesmo CNJ
const MAX_ENTRIES = 800;

function prune() {
  if (store.size <= MAX_ENTRIES) return;
  const now = Date.now();
  for (const [k, v] of store) {
    if (v.expires < now) store.delete(k);
  }
  if (store.size <= MAX_ENTRIES) return;
  // remove oldest half
  const keys = [...store.keys()].slice(0, Math.floor(store.size / 2));
  for (const k of keys) store.delete(k);
}

/** Lê cache se ainda válido */
export function perfGet<T>(key: string): T | undefined {
  const hit = store.get(key);
  if (!hit) return undefined;
  if (hit.expires < Date.now()) {
    store.delete(key);
    return undefined;
  }
  return hit.value as T;
}

export function perfSet<T>(key: string, value: T, ttlMs = DEFAULT_TTL_MS) {
  prune();
  store.set(key, { value, expires: Date.now() + ttlMs });
}

export function perfClear(prefix?: string) {
  if (!prefix) {
    store.clear();
    inflight.clear();
    return;
  }
  for (const k of [...store.keys()]) {
    if (k.startsWith(prefix)) store.delete(k);
  }
  for (const k of [...inflight.keys()]) {
    if (k.startsWith(prefix)) inflight.delete(k);
  }
}

/**
 * Executa fn com cache + dedupe de requisições simultâneas (mesmo key).
 */
export async function perfCached<T>(
  key: string,
  fn: () => Promise<T>,
  ttlMs = DEFAULT_TTL_MS
): Promise<T> {
  const cached = perfGet<T>(key);
  if (cached !== undefined) return cached;

  const pending = inflight.get(key) as Promise<T> | undefined;
  if (pending) return pending;

  const run = (async () => {
    try {
      const value = await fn();
      // não cacheia erros óbvios / vazios críticos opcionalmente
      perfSet(key, value, ttlMs);
      return value;
    } finally {
      inflight.delete(key);
    }
  })();

  inflight.set(key, run);
  return run;
}

/** Pool: processa itens com concorrência limitada */
export async function perfPool<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const n = Math.max(1, Math.min(concurrency, 8));
  const results: R[] = new Array(items.length);
  let next = 0;

  async function lane() {
    while (next < items.length) {
      const i = next++;
      results[i] = await worker(items[i], i);
    }
  }

  await Promise.all(Array.from({ length: Math.min(n, items.length) }, () => lane()));
  return results;
}

export function perfNow() {
  return typeof performance !== 'undefined' && performance.now
    ? performance.now()
    : Date.now();
}

export function perfLog(label: string, start: number, extra?: Record<string, unknown>) {
  const ms = Math.round(perfNow() - start);
  if (process.env.NODE_ENV === 'development' || process.env.PERF_LOG === '1') {
    console.log(`[PERF] ${label} ${ms}ms`, extra || '');
  }
  return ms;
}

/** Chaves padronizadas */
export const PerfKeys = {
  datajud: (cnj: string, fast?: boolean) =>
    `dj:${String(cnj).replace(/\D/g, '')}:${fast ? 'f' : 's'}`,
  djen: (cnj: string, from?: string, to?: string) =>
    `djen:${String(cnj).replace(/\D/g, '')}:${from || ''}:${to || ''}`,
};

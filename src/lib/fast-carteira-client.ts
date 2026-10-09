import type { LegalCase } from '@/lib/case-logic';

export type CarteiraSnapshot = {
  total: number; ativos: number; encerrados: number; vencidos: number;
  baixas: number; procedentes: number; cumprimentos: number; novidades: number;
};
export type FastCarteiraResponse = {
  ok: true; cases: LegalCase[]; summary: CarteiraSnapshot;
  totalCount: number; hasMore: boolean; offset: number; limit: number;
};

/** Standard HTTP GET avoids Server Action flight-format transport errors. */
export async function fetchFastCarteira(
  scope: 'mine' | 'empresa',
  limit = 60,
  offset = 0,
  signal?: AbortSignal
): Promise<FastCarteiraResponse> {
  const qs = new URLSearchParams({
    scope, limit: String(Math.max(1, Math.min(limit, 100))),
    offset: String(Math.max(0, offset)),
  });
  const res = await fetch('/api/carteira/fast?' + qs, {
    method: 'GET', credentials: 'same-origin', cache: 'no-store',
    headers: { Accept: 'application/json' }, signal,
  });
  const ct = res.headers.get('content-type') || '';
  if (!ct.includes('application/json')) throw new Error('Servidor retornou um formato inesperado. Atualize a página.');
  const body = await res.json();
  if (!res.ok || !body?.ok || !Array.isArray(body.cases)) {
    throw new Error(body?.error || 'A consulta à carteira falhou.');
  }
  return body as FastCarteiraResponse;
}

/** Cache de snapshot de listagem empresarial. Sempre particionado pelo login. */
const FAST_KEY = 'lexis_fast_carteira_v1:';
const FAST_TTL_MS = 5 * 60_000;
type FastEntry = { at: number; data: FastCarteiraResponse };
const fastMemory = new Map<string, FastEntry>();
const inFlightPages = new Map<string, Promise<FastCarteiraResponse>>();
function keyFor(scope: 'mine' | 'empresa', limit: number, offset: number, empresaId: string, userId: string) {
  return FAST_KEY + [empresaId, userId, scope, limit, offset].join(':');
}
export function peekFastCarteiraCache(
  scope: 'mine' | 'empresa', limit: number, offset: number, empresaId: string, userId: string
): { data: FastCarteiraResponse; ageMs: number } | null {
  if (!empresaId || !userId) return null;
  const key = keyFor(scope, limit, offset, empresaId, userId);
  let entry = fastMemory.get(key);
  if (!entry && typeof window !== 'undefined') {
    try {
      const stored = sessionStorage.getItem(key);
      if (stored) entry = JSON.parse(stored) as FastEntry;
    } catch { /* browser storage indisponivel */ }
  }
  if (!entry?.data?.ok || !Array.isArray(entry.data.cases)) return null;
  const ageMs = Date.now() - entry.at;
  if (ageMs < 0 || ageMs > 10 * 60_000) return null;
  fastMemory.set(key, entry);
  return { data: entry.data, ageMs };
}
export function rememberFastCarteira(
  scope: 'mine' | 'empresa', limit: number, offset: number,
  empresaId: string, userId: string, data: FastCarteiraResponse
) {
  if (!empresaId || !userId || !data?.ok) return;
  const key = keyFor(scope, limit, offset, empresaId, userId);
  const entry: FastEntry = { at: Date.now(), data };
  fastMemory.set(key, entry);
  if (typeof window !== 'undefined' && offset === 0) {
    try {
      const str = JSON.stringify(entry);
      if (str.length < 350_000) sessionStorage.setItem(key, str);
    } catch { /* memory only */ }
  }
}
export function invalidateFastCarteiraCache() {
  fastMemory.clear();
  if (typeof window === 'undefined') return;
  try {
    for (let i = sessionStorage.length - 1; i >= 0; i--) {
      const key = sessionStorage.key(i);
      if (key?.startsWith(FAST_KEY)) sessionStorage.removeItem(key);
    }
  } catch { /* noop */ }
}
export async function fetchFastCarteiraCached(
  scope: 'mine' | 'empresa', limit: number, offset: number,
  empresaId: string, userId: string, force = false
): Promise<FastCarteiraResponse> {
  const cached = peekFastCarteiraCache(scope, limit, offset, empresaId, userId);
  if (!force && cached && cached.ageMs < FAST_TTL_MS) return cached.data;
  const key = keyFor(scope, limit, offset, empresaId, userId);
  const running = inFlightPages.get(key);
  if (running) return running;
  const request = fetchFastCarteira(scope, limit, offset, AbortSignal.timeout(25_000))
    .then((next) => { rememberFastCarteira(scope, limit, offset, empresaId, userId, next); return next; })
    .finally(() => inFlightPages.delete(key));
  inFlightPages.set(key, request);
  return request;
}

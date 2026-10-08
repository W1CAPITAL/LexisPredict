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

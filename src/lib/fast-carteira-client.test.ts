import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchFastCarteira, fetchFastCarteiraCached, invalidateFastCarteiraCache, peekFastCarteiraCache } from './fast-carteira-client';

afterEach(() => { vi.unstubAllGlobals(); invalidateFastCarteiraCache(); });

describe('Fast tenant-scoped carteira client', () => {
  it('uses same-origin JSON and bounded company pagination', async () => {
    const fn = vi.fn(async (..._args: any[]) => new Response(JSON.stringify({
      ok: true, cases: [{ id: '1', protocolo: '000', cliente: 'TESTE' }],
      summary: { total: 2643, ativos: 815, encerrados: 1828, vencidos: 401, baixas: 814, procedentes: 237, cumprimentos: 509, novidades: 327 },
      totalCount: 2643, hasMore: true, offset: 0, limit: 100,
    }), { headers: { 'content-type': 'application/json' } }));
    vi.stubGlobal('fetch', fn);
    const res = await fetchFastCarteira('empresa', 500, 0);
    expect(res.totalCount).toBe(2643);
    expect(res.cases[0].cliente).toBe('TESTE');
    expect(String(fn.mock.calls[0][0])).toContain('scope=empresa');
    expect(String(fn.mock.calls[0][0])).toContain('limit=100');
    expect((fn.mock.calls[0][1] as RequestInit).credentials).toBe('same-origin');
  });
  it('shows HTTP errors rather than a false empty carteira', async () => {
    vi.stubGlobal('fetch', async () => new Response(JSON.stringify({ok: false, error: 'Sessão expirada'}), {
      status: 401, headers: { 'content-type': 'application/json' }
    }));
    await expect(fetchFastCarteira('mine')).rejects.toThrow('Sessão expirada');
  });
  it('rejects HTML error responses safely', async () => {
    vi.stubGlobal('fetch', async () => new Response('<html>failed</html>', { status: 503, headers: { 'content-type': 'text/html' } }));
    await expect(fetchFastCarteira('mine')).rejects.toThrow('formato inesperado');
  });
  it('reaproveita paginas recentes sem misturar logins ou empresas', async () => {
    const payload = {
      ok: true, cases: [{ id: '1', protocolo: 'CNJ', cliente: 'TESTE' }],
      summary: { total: 2643, ativos: 815, encerrados: 1828, vencidos: 395, baixas: 829, procedentes: 238, cumprimentos: 509, novidades: 330 },
      totalCount: 2643, hasMore: true, offset: 0, limit: 60,
    };
    const fn = vi.fn(async () => new Response(JSON.stringify(payload), {
      headers: { 'content-type': 'application/json' },
    }));
    vi.stubGlobal('fetch', fn);
    await fetchFastCarteiraCached('empresa', 60, 0, 'empresa-a', 'operador-a');
    await fetchFastCarteiraCached('empresa', 60, 0, 'empresa-a', 'operador-a');
    expect(fn).toHaveBeenCalledTimes(1);
    await fetchFastCarteiraCached('empresa', 60, 0, 'empresa-a', 'operador-b');
    await fetchFastCarteiraCached('empresa', 60, 0, 'empresa-b', 'operador-a');
    expect(fn).toHaveBeenCalledTimes(3);
    expect(peekFastCarteiraCache('empresa', 60, 0, 'empresa-a', 'operador-a')?.data.totalCount).toBe(2643);
    invalidateFastCarteiraCache();
    expect(peekFastCarteiraCache('empresa', 60, 0, 'empresa-a', 'operador-a')).toBeNull();
  });

});

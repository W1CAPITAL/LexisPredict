import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const cnj = '3002816-74.2026.8.06.0154';
const digits = '30028167420268060154';
const apiResponse = (payload: unknown, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  headers: { get: () => null },
  json: async () => payload,
});

beforeEach(() => {
  vi.resetModules();
  vi.stubGlobal('window', {});
});
afterEach(() => vi.unstubAllGlobals());

describe('DataJud diretamente no navegador do usuário', () => {
  it('envia somente CNJ para endpoint oficial do tribunal e aceita número idêntico', async () => {
    const fetcher = vi.fn().mockResolvedValue(apiResponse({
      timed_out: false, _shards: { failed: 0 },
      hits: { hits: [{ _source: { numeroProcesso: digits, movimentos: [{ codigo: 132, nome: 'Distribuição' }] } }] },
    }));
    vi.stubGlobal('fetch', fetcher);
    const { fetchDataJudDirectBrowser } = await import('@/lib/datajud-browser-client');
    const result = await fetchDataJudDirectBrowser(cnj);
    expect(result).toMatchObject({ ok: true, found: true });
    expect(result.movimentos).toHaveLength(1);
    const [url, request] = fetcher.mock.calls[0];
    expect(url).toBe('https://api-publica.datajud.cnj.jus.br/api_publica_tjce/_search');
    expect(request.method).toBe('POST');
    expect(request.credentials).toBe('omit');
    expect(request.mode).toBe('cors');
    expect(JSON.parse(request.body).query.match.numeroProcesso).toBe(digits);
    expect(String(request.headers.Authorization)).toMatch(/^APIKey /);
    expect(String(request.body)).not.toContain('cpf');
  });

  it('rejeita CNJ divergente, ainda que o índice retorne hit', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(apiResponse({
      hits: { hits: [{ _source: { numeroProcesso: '00000000000000000000', movimentos: [{ nome: 'errado' }] } }] },
    })));
    const { fetchDataJudDirectBrowser } = await import('@/lib/datajud-browser-client');
    expect(await fetchDataJudDirectBrowser(cnj)).toMatchObject({ ok: false, reason: 'cnj_mismatch' });
  });

  it('não considera HTTP 200 com timeout interno ou shards falhos como sucesso', async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(apiResponse({ timed_out: true, hits: { hits: [] } }))
      .mockResolvedValueOnce(apiResponse({ _shards: { failed: 1 }, hits: { hits: [] } }));
    vi.stubGlobal('fetch', fetcher);
    const { fetchDataJudDirectBrowser } = await import('@/lib/datajud-browser-client');
    expect(await fetchDataJudDirectBrowser(cnj)).toMatchObject({ ok: false, reason: 'index_timeout' });
    expect(await fetchDataJudDirectBrowser(cnj)).toMatchObject({ ok: false, reason: 'shard_failure' });
  });

  it('não trata a ausência do CNJ no índice como movimentações verificadas', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(apiResponse({ hits: { hits: [] }, timed_out: false })));
    const { fetchDataJudDirectBrowser } = await import('@/lib/datajud-browser-client');
    expect(await fetchDataJudDirectBrowser(cnj)).toMatchObject({ ok: false, found: false, reason: 'not_indexed' });
  });

  it('suspende tentativas diretas após falha de CORS/rede, preservando possibilidade de fallback', async () => {
    const fetcher = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));
    vi.stubGlobal('fetch', fetcher);
    const { fetchDataJudDirectBrowser } = await import('@/lib/datajud-browser-client');
    expect(await fetchDataJudDirectBrowser(cnj)).toMatchObject({ ok: false, reason: 'network_error' });
    expect(await fetchDataJudDirectBrowser(cnj)).toMatchObject({ ok: false, reason: 'browser_cooldown' });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('limite 429 de um tribunal não impede consulta de outro tribunal', async () => {
    const other = '1002670-83.2025.8.26.0271';
    const otherDigits = other.replace(/\D/g, '');
    const fetcher = vi.fn()
      .mockResolvedValueOnce(apiResponse({}, 429))
      .mockResolvedValueOnce(apiResponse({
        hits: { hits: [{ _source: { numeroProcesso: otherDigits, movimentos: [] } }] },
      }));
    vi.stubGlobal('fetch', fetcher);
    const { fetchDataJudDirectBrowser } = await import('@/lib/datajud-browser-client');
    expect(await fetchDataJudDirectBrowser(cnj)).toMatchObject({ ok: false, reason: 'rate_limited' });
    expect(await fetchDataJudDirectBrowser(other)).toMatchObject({ ok: true, found: true });
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('não repete requisição imediata quando a API retorna limite HTTP 429', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(apiResponse({}, 429)));
    const { fetchDataJudDirectBrowser } = await import('@/lib/datajud-browser-client');
    expect(await fetchDataJudDirectBrowser(cnj)).toMatchObject({ ok: false, reason: 'rate_limited', status: 429 });
    expect(await fetchDataJudDirectBrowser(cnj)).toMatchObject({ ok: false, reason: 'rate_limited' });
  });
});

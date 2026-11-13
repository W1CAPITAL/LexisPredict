import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  datajudBrowser: vi.fn(),
  serverScan: vi.fn(),
  djenBrowser: vi.fn(),
  djenPersist: vi.fn(),
}));
vi.mock('@/lib/datajud-browser-client', () => ({
  fetchDataJudDirectBrowser: mocks.datajudBrowser,
}));
vi.mock('@/lib/djen-client', () => ({
  djenBuscaProcesso: mocks.djenBrowser,
}));
vi.mock('@/app/actions/case-actions', () => ({
  scanSingleCaseAction: mocks.serverScan,
  applyBrowserDjenResultAction: mocks.djenPersist,
}));
import { scanInteractiveCase } from '@/lib/interactive-tribunal-scan';

const cnj = '3002816-74.2026.8.06.0154';
beforeEach(() => {
  for (const mock of Object.values(mocks)) mock.mockReset();
  mocks.djenBrowser.mockResolvedValue({ ok: true, items: [], count: 0 });
  mocks.djenPersist.mockResolvedValue({ success: true, comunicacoes: [], casePatch: {} });
  mocks.serverScan.mockResolvedValue({
    success: true, offline: false, movimentos: [],
    sourceStatus: { datajud: { requested: true, ok: true } },
    casePatch: { datajud_consultado_em: '2026-11-13' },
  });
});

describe('Consulta interativa DataJud: navegador primeiro, servidor como alternativa', () => {
  it('exibe movimentos de resposta oficial do navegador sem chamar DataJud do servidor', async () => {
    mocks.datajudBrowser.mockResolvedValue({
      ok: true, found: true,
      movimentos: [{ codigo: 100, nome: 'Juntada de documento' }],
    });
    const result = await scanInteractiveCase(cnj, { mode: 'datajud' });
    expect(result.sourceStatus.datajud).toMatchObject({ ok: true, via: 'browser' });
    expect(result.movimentos).toHaveLength(1);
    expect(result.success).toBe(true);
    expect(mocks.serverScan).not.toHaveBeenCalled();
    expect(result.casePatch).not.toHaveProperty('datajud_consultado_em');
  });

  it('reutiliza o servidor quando o navegador não consegue concluir a requisição', async () => {
    mocks.datajudBrowser.mockResolvedValue({ ok: false, found: false, reason: 'network_error', error: 'CORS ou rede indisponível', movimentos: [] });
    const result = await scanInteractiveCase(cnj, { mode: 'datajud' });
    expect(result.sourceStatus.datajud).toMatchObject({ ok: true, via: 'server' });
    expect(mocks.serverScan).toHaveBeenCalledWith(cnj, expect.objectContaining({ mode: 'datajud' }));
    expect(result.casePatch).toHaveProperty('datajud_consultado_em');
  });

  it('não dispara o servidor imediatamente depois de 429 da mesma fonte', async () => {
    mocks.datajudBrowser.mockResolvedValue({ ok: false, reason: 'rate_limited', status: 429, error: 'Limite 429', movimentos: [] });
    const result = await scanInteractiveCase(cnj, { mode: 'datajud' });
    expect(result.sourceStatus.datajud).toMatchObject({ ok: false });
    expect(result.offline).toBe(true);
    expect(result.movimentos).toEqual([]);
    expect(mocks.serverScan).not.toHaveBeenCalled();
  });

  it('não transforma erro de ambas as origens em ausência de movimentações', async () => {
    mocks.datajudBrowser.mockResolvedValue({ ok: false, reason: 'timeout', error: 'Tempo esgotado no navegador', movimentos: [] });
    mocks.serverScan.mockResolvedValue({
      offline: true, error: 'Tempo esgotado no servidor',
      movimentos: [], sourceStatus: { datajud: { ok: false } },
    });
    const result = await scanInteractiveCase(cnj, { mode: 'datajud' });
    expect(result.sourceStatus.datajud).toMatchObject({ ok: false, empty: false });
    expect(result.offline).toBe(true);
    expect(result.error).toContain('Tempo esgotado');
  });

  it('mantém a consulta DJEN pelo navegador ao consultar ambas as fontes', async () => {
    mocks.datajudBrowser.mockResolvedValue({ ok: true, found: true, movimentos: [] });
    mocks.djenBrowser.mockResolvedValue({ ok: true, items: [{ numeroProcesso: cnj }], count: 1 });
    mocks.djenPersist.mockResolvedValue({ success: true, comunicacoes: [{ numero_processo: cnj }], casePatch: { djen_count: 1 } });
    const result = await scanInteractiveCase(cnj, { mode: 'both' });
    expect(result.sourceStatus.datajud.via).toBe('browser');
    expect(result.sourceStatus.djen.via).toBe('browser');
    expect(result.partial).toBe(false);
  });
});

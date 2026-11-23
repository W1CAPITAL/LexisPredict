import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({
  getUserContext: vi.fn(),
  getStoredCasesPageForEmpresa: vi.fn(),
  getPortfolioSnapshotCached: vi.fn(),
}));

vi.mock('@/lib/server-db', () => ({
  getUserContext: mocks.getUserContext,
  getStoredCasesPageForEmpresa: mocks.getStoredCasesPageForEmpresa,
}));
vi.mock('@/lib/portfolio-snapshot', () => ({
  getPortfolioSnapshotCached: mocks.getPortfolioSnapshotCached,
  getMeritoSnapshotCached: vi.fn(),
  getRetornoSnapshotCached: vi.fn(),
}));

import { GET as fast } from './fast/route';
import { GET as indicadores } from './indicadores/route';

beforeEach(() => {
  vi.resetAllMocks();
  mocks.getUserContext.mockResolvedValue({ auth_id: 'user-a', empresa_id: 'tenant-a', caseScope: 'mine' });
});

describe('Carteira e indicadores independentes', () => {
  it('retorna a lista autenticada quando o banco de indicadores falha', async () => {
    mocks.getStoredCasesPageForEmpresa.mockResolvedValue([{ id: '1' }]);
    mocks.getPortfolioSnapshotCached.mockRejectedValue(new Error('timeout'));
    const page = await fast(new NextRequest('http://127.0.0.1/api/carteira/fast?scope=empresa&summary=0'));
    expect(page.status).toBe(200);
    expect(await page.json()).toMatchObject({ cases: [{ id: '1' }], totalCount: null });
    expect(mocks.getStoredCasesPageForEmpresa).toHaveBeenCalledWith(
      'tenant-a', 60, 0, false, expect.objectContaining({ companyReadOnly: true }),
    );
    expect(mocks.getPortfolioSnapshotCached).not.toHaveBeenCalled();
    const kpis = await indicadores(new NextRequest('http://127.0.0.1/api/carteira/indicadores?scope=empresa'));
    expect(kpis.status).toBe(503);
    expect(await kpis.json()).not.toHaveProperty('indicadores');
  });

  it('recusa um indicador ausente e preserva zeros confirmados', async () => {
    const request = new NextRequest('http://127.0.0.1/api/carteira/indicadores');
    mocks.getPortfolioSnapshotCached
      .mockResolvedValueOnce({ total: 2, ativos: 2, encerrados: 0 })
      .mockResolvedValueOnce({ total: '0', ativos: 0, encerrados: 0, vencidos: 0 });
    expect((await indicadores(request)).status).toBe(503);
    expect(await (await indicadores(request)).json()).toMatchObject({
      indicadores: { total: 0, ativos: 0, encerrados: 0, vencidos: 0 },
    });
  });
});

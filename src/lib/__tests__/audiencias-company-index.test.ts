import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

describe('indexação e leitura empresarial de audiências', () => {
  it('executa indexação incremental no cron Hermes ativo de cinco minutos', () => {
    const route = read('src/app/api/cron/hermes-returns/route.ts');
    expect(route).toContain('atualizarIndiceAudienciasLote');
    expect(route).toContain('audienciasIndex');
  });

  it('lista todos os registros da empresa por paginação, sem filtrar o responsável', () => {
    const route = read('src/app/api/audiencias/route.ts');
    expect(route).toContain(".eq('empresa_id',ctx.empresa_id)");
    expect(route).toContain('.range(');
    expect(route).not.toMatch(/\.eq\(['"]created_by['"]/);
  });

  it('mantém na fila processos de colaboradores diferentes do mesmo tenant', async () => {
    const { listCompanyDueReturns } = await import('@/lib/company-return-queue');
    const cases = [
      { id: 'a', db_id: 'a', created_by: 'colaborador-1', cliente: 'Cliente A', protocolo: '1000000-00.2026.8.26.0001', ultimoRetorno: '2026-11-01', proximoPrazo: '2026-11-11', status: 'No Prazo', situacao: 'EM ANDAMENTO' },
      { id: 'b', db_id: 'b', created_by: 'colaborador-2', cliente: 'Cliente B', protocolo: '1000000-00.2026.8.26.0002', ultimoRetorno: '2026-11-02', proximoPrazo: '2026-11-11', status: 'No Prazo', situacao: 'EM ANDAMENTO' },
    ];
    expect(listCompanyDueReturns(cases as never, '2026-11-11')).toHaveLength(2);
  });
});

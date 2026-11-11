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

  it('usa endpoint direto por empresa na fila /tarefas, sem filtrar created_by', () => {
    const route = read('src/app/api/tarefas/retornos-empresa/route.ts');
    const queue = read('src/components/returns/company-due-queue.tsx');
    expect(route).toContain(".eq('empresa_id', ctx.empresa_id)");
    expect(route).toContain(".lte('proximo_retorno', ate)");
    expect(route).not.toMatch(/\.eq\(['"]created_by['"]/);
    expect(queue).toContain('loadAllCompanyDueReturns');
  });

  it('percorre todas as páginas da empresa, inclusive responsáveis diferentes', async () => {
    const pages = [
      { ok: true, scope: 'empresa', cases: [{ id: 'a', created_by: 'colaborador-1' }], hasMore: true },
      { ok: true, scope: 'empresa', cases: [{ id: 'b', created_by: 'colaborador-2' }], hasMore: false },
    ];
    const urls: string[] = [];
    const fetcher = (async (input: RequestInfo | URL) => {
      urls.push(String(input));
      const payload = pages.shift();
      return { ok: true, json: async () => payload } as Response;
    }) as typeof fetch;
    const { loadAllCompanyDueReturns } = await import('@/lib/today-due-consistency');
    const rows = await loadAllCompanyDueReturns<{ id: string; created_by: string }>(
      '2026-11-11',
      { pageSize: 1, fetcher },
    );
    expect(rows.map((row) => row.id)).toEqual(['a', 'b']);
    expect(rows.map((row) => row.created_by)).toEqual(['colaborador-1', 'colaborador-2']);
    expect(urls).toHaveLength(2);
    expect(urls[1]).toContain('offset=1');
  });

  it('expõe o intervalo final e a limpeza com fuso confirmado', () => {
    const page = read('src/app/audiencias/page.tsx');
    const migration = read('supabase/migrations/20261111170000_audiencias_periodo_fuso_chave.sql');
    expect(page).toContain('Período da sessão');
    expect(page).toContain('até {formatDay(x.data_fim)}');
    expect(migration).toContain('America/Fortaleza');
    expect(migration).toContain('trg_normalize_audiencia_chave');
    expect(migration).toContain('< local_clock.local_now::time');
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
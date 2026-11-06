import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';

describe('Dashboard sem KPIs parciais tratados como totais reais',()=>{
 it('mostra vencidos somente quando existe contagem completa do escopo autorizado',()=>{
  const page=readFileSync('src/app/page.tsx','utf8');
  const overview=page.slice(page.indexOf('<DashboardVisualOverview'),page.indexOf('<DashboardVisualOverview')+650);
  expect(overview).toContain('vencidos={portfolioSummary?.vencidos ?? null}');
  expect(overview).not.toContain('metrics.countVencido');
 });
 it('informa indisponibilidade da fonte em vez de apresentar zero ou número inventado',()=>{
  const visual=readFileSync('src/components/dashboard/dashboard-visual-overview.tsx','utf8');
  expect(visual).toContain('vencidos == null ? "Consulta indisponível"');
  expect(visual).toContain('value: integer(vencidos, loading)');
 });
});
import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
const read=(p:string)=>readFileSync(p,'utf8');

describe('KPIs empresariais e busca contínua de audiências',()=>{
 it('faz o snapshot agregado sempre por empresa, mantendo a lista respeitando o escopo',()=>{
  const api=read('src/app/api/carteira/fast/route.ts');
  expect(api).toContain('const ownerScope: string | null = null');
  expect(api).toContain('getPortfolioSnapshotCached(empresaId,ownerScope)');
  expect(api).toContain('getStoredCasesPageForEmpresa(empresaId, limit, offset');
 });
 it('usa situação operacional tipada antes de campos antigos do JSON no SQL',()=>{
  const sql=read('supabase/migrations/20261111134500_company_overdue_kpis_hermes_24h.sql');
  expect(sql).toContain('p.status_interno');
  expect(sql).toContain('p.dados->>\'situacao\'');
  expect(sql).toContain('ultimo_retorno<=proximo_retorno');
  expect(sql).not.toContain('NOT closed_manual');
 });
 it('agenda duas verificações incrementais por minuto e retenta estados parciais',()=>{
  const sql=read('supabase/migrations/20261111134500_company_overdue_kpis_hermes_24h.sql');
  const service=read('src/lib/hermes-return-service.ts');
  expect(sql).toContain("schedule := '* * * * *'");
  expect(sql).toContain('FOR UPDATE OF p SKIP LOCKED');
  expect(sql).toContain("interval '24 hours'");
  expect(sql).toContain("interval '12 hours'");
  expect(service).toContain("rpc('hermes_claim_portfolio_scan_batch'");
  expect(service).toContain('p_limit:2');
  expect(service).toContain('atualizarAudienciasDeConsulta');
 });
});

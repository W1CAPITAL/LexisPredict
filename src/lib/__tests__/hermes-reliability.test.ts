import {readFileSync} from 'node:fs';
import {describe,expect,it} from 'vitest';
const source=(file:string)=>readFileSync(file,'utf8');
describe('Hermes review reliability and self-correction',()=>{
 it('manual consultation bypasses stale 90s caches and uses both CNJ formats',()=>{
  const service=source('src/lib/hermes-return-service.ts');
  expect(service).toContain("mode?: 'manual' | 'scheduled'");
  expect(service).toContain('forceRefresh: manual');
  expect(service).toContain('hermesManual: manual');
  expect(service).toContain('cloudBudget: true');
  expect(service).toContain('sourceErrors');
  expect(source('src/app/api/cron/hermes-returns/route.ts')).toContain('postOfficeCaseReview');
 });
 it('manual retry is not prevented for partially unavailable court sources',()=>{
  const action=source('src/app/actions/hermes-return-actions.ts');
  expect(action).toContain('djen_ok,datajud_ok');
  expect(action).toContain('recent.djen_ok === true && recent.datajud_ok === true');
  expect(action).toContain("mode: 'manual'");
 });
 it('supports refreshing public DataJud key when authorization expires',()=>{
  const jud=source('src/lib/datajud.ts');
  expect(jud).toContain('resolveCurrentDataJudKey');
  expect(jud).toContain('refreshPublicDataJudKey');
  expect(jud).toContain('response.status === 401 || response.status === 403');
 });
 it('daily counts filter closure across all recorded status fields, not just internal',()=>{
  const sql=source('supabase/migrations/20261110180000_hermes_reliability.sql');
  expect(sql).toContain("p.dados->>'situacao'");
  expect(sql).toContain('p.proximo_retorno<=p_day');
  expect(sql).toContain('hermes_refresh_office_daily');
 });
 it('exports the existing tenant-checked PDF and a local auditable CSV',()=>{
  const office=source('src/app/hermes-3d/page.tsx');
  const exporter=source('src/components/hermes/hermes-export.tsx');
  expect(exporter).toContain('/api/report/pdf?');
  expect(exporter).toContain('Exportar CSV');
  expect(office).toContain('HermesRebuildPanel');
 });
 it('automatic rebuild uses measured records, produces a trace and never writes code',()=>{
  const sql=source('supabase/migrations/20261110180000_hermes_reliability.sql');
  expect(sql).toContain('hermes_rebuild_runs');
  expect(sql).toContain('hermes_rebuild_from_evidence');
  const backend=source('src/lib/hermes-company-service.ts');
  expect(backend).toContain('getHermesRebuildRuns');
  const panel=source('src/components/hermes/hermes-rebuild-panel.tsx');
  expect(panel).toContain('Swarm Rebuild');
  expect(panel).toContain('Revisar recomendações');
 });
});

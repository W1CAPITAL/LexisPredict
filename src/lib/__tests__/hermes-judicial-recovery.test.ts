import { describe,expect,it } from 'vitest';
import { readFileSync } from 'node:fs';
import { classifyHermesSourceStatus } from '@/lib/hermes-source-diagnostics';
import { buildHermesReturnReview } from '@/lib/hermes-return-policy';
const source=(file:string)=>readFileSync(file,'utf8');

describe('Hermes trustworthy judicial source results',()=>{
 it('does not prepare a judicial response when both official sources failed',()=>{
  const result=buildHermesReturnReview({
   cliente:'Cliente de teste',protocolo:'00000000000000000000',
   ultimoRetorno:'2026-10-09',proximoRetorno:'2026-11-10',status:'EM ANDAMENTO',today:'2026-11-10',
  },{datajudOk:false,djenOk:false,events:[]});
  expect(result.state).toBe('unavailable');
  expect(result.messageDraft).toBe(null);
  expect(result.suggestedNextReturn).toBe(null);
 });
 it('distinguishes request rejection and not found from successful empty publication',()=>{
  expect(classifyHermesSourceStatus('djen',{success:false,error:'HTTP 403',isGeoBlocked:true})).toBe('restricted_region');
  expect(classifyHermesSourceStatus('djen',{success:false,error:'Rate limit DJEN (429)',isRateLimited:true})).toBe('rate_limited');
  expect(classifyHermesSourceStatus('datajud',{error:false,found:false,message:'Não localizado no índice'})).toBe('not_indexed');
  expect(classifyHermesSourceStatus('djen',{success:true,count:0,items:[]})).toBe('checked_no_publications');
  expect(classifyHermesSourceStatus('datajud',{error:true,message:'Tempo esgotado no tribunal'})).toBe('timeout');
 });
 it('forces new official requests on manual retry but preserves one-case cron budget',()=>{
  const service=source('src/lib/hermes-return-service.ts');
  const actions=source('src/app/actions/hermes-return-actions.ts');
  expect(service).toContain('manual?: boolean');
  expect(service).toContain('forceRefresh: manual');
  expect(actions).toContain('manual: true');
  expect(actions).toContain("recent?.state === 'ready'");
  expect(source('src/app/api/cron/hermes-returns/route.ts')).toContain('runHermesDueReviewBatch(1)');
 });
 it('saves source failure classifications for UI review, no secret/raw traceback',()=>{
  const service=source('src/lib/hermes-return-service.ts');
  const actions=source('src/app/actions/hermes-return-actions.ts');
  const panel=source('src/components/hermes/hermes-return-review-button.tsx');
  expect(service).toContain('djenStatus');
  expect(service).toContain('datajudStatus');
  expect(actions).toContain('source_snapshot');
  expect(panel).toContain('source_snapshot');
  expect(panel).toContain('Abrir consulta oficial');
 });
});

describe('Hermes audited due count / export / safe learning',()=>{
 it('excludes closed status in ALL known fields in the materialized snapshot',()=>{
   const sql=source('supabase/migrations/20261110180000_hermes_count_fix.sql');
   expect(sql).toContain("p.dados->>'situacao'");
   expect(sql).toContain("coalesce(p.status_interno");
   expect(sql).toContain("coalesce(p.status");
   expect(sql).toContain('hermes_refresh_office_daily');
 });
 it('provides immediate export from /hermes-3d and works with existing authenticated PDF endpoint',()=>{
  const page=source('src/app/hermes-3d/page.tsx');
  expect(page).toContain('/api/report/pdf');
  expect(page).toContain('Baixar relatório PDF');
 });
 it('adapts query strategy to confirmed failure categories instead of editing production code',()=>{
  const src=source('src/lib/hermes-source-diagnostics.ts');
  expect(src).toContain('chooseHermesRetryPlan');
  expect(src).not.toContain('eval(');
  expect(src).not.toContain('exec(');
 });
 it('adds a small persistent navigation progress instead of only brief skeleton fallbacks',()=>{
  expect(source('src/components/layout/persistent-app-shell.tsx')).toContain('SwarmNavigationProgress');
  expect(source('src/components/ui/swarm-navigation-progress.tsx')).toContain('SwarmLoadingIndicator');
 });
});

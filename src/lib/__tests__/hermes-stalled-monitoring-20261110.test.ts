import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
const read=(path:string)=>readFileSync(path,'utf8');

describe('Hermes: monitoramento automático independente dos retornos',()=>{
 it('mantém evidências de processos parados numa tabela isolada por empresa e segura',()=>{
  const sql=read('supabase/migrations/20261110210000_hermes_stalled_monitoring.sql');
  expect(sql).toContain('public.hermes_stalled_reviews');
  expect(sql).toContain('enable row level security');
  expect(sql).toContain('revoke all on public.hermes_stalled_reviews from public, anon, authenticated');
  expect(sql).toContain('grant execute on function public.hermes_claim_stalled_review(date) to service_role');
  expect(sql).toContain('p.empresa_id is not null');
  expect(sql).toContain('p_today-15');
  expect(sql).not.toContain('update public.processos');
 });
 it('usa rotas independentes, sem fila de parados bloqueada por retornos',()=>{
  const file=read('src/lib/hermes-return-service.ts');
  expect(file).toContain('runHermesStalledReviewBatch()');
  expect(file).toContain("rpc('hermes_claim_stalled_review'");
  expect(file).not.toContain('results.length===0');
  expect(file).toContain("obtainCourtSnapshot(cnj,null,false)");
  expect(file).toContain("state:'unavailable'");
  expect(file).not.toContain('sendWhatsApp');
  const route=read('src/app/api/cron/hermes-returns/route.ts');
  expect(route).toContain('runHermesDueReviewBatch(1)');
  expect(route).toContain('runHermesStalledReviewBatch');
  expect(route).toContain("mode === 'stalled'");
  expect(route).toContain('getHermesStalledSummaries');
 });
 it('exibe resultado autorizado por empresa em painel distinto de retornos',()=>{
  const panel=read('src/components/hermes/hermes-stalled-monitoring.tsx');
  const page=read('src/app/hermes-3d/page.tsx');
  expect(page).toContain('HermesStalledMonitoring');
  expect(panel).toContain('Consulta parcial');
  expect(panel).toContain('não torna o retorno vencido');
  expect(read('src/lib/hermes-company-service.ts')).toContain(".eq('empresa_id',empresaId)");
 });
});

import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
const read=(path:string)=>readFileSync(path,'utf8');

describe('Hermes independente: atrasos da fonte não interrompem monitoramento',()=>{
 it('tem um endpoint autenticado independente para processos parados',()=>{
  const route=read('src/app/api/cron/hermes-returns/route.ts');
  expect(route).toContain("mode === 'stalled'");
  expect(route).toContain('runHermesStalledReviewBatch');
  expect(route.indexOf("if (!authorized(request))")).toBeLessThan(route.indexOf("mode === 'stalled'"));
  expect(route).toContain("runHermesDueReviewBatch(1)");
 });
 it('retornos e parados não dependem da ausência de processos na outra fila',()=>{
  const service=read('src/lib/hermes-return-service.ts');
  expect(service).not.toContain('results.length===0&&Date.now()-started<3000');
  expect(service).toContain("rpc('hermes_claim_stalled_review'");
  expect(service).not.toContain('sendWhatsApp');
 });
 it('agenda as duas filas em horários diferentes 24h com acesso privado',()=>{
  const sql=read('supabase/migrations/20261111060000_hermes_independent_24h.sql');
  expect(sql).toContain("'lexis-hermes-due-returns'");
  expect(sql).toContain("'*/5 * * * *'");
  expect(sql).toContain("'lexis-hermes-stalled-monitor'");
  expect(sql).toContain("'2-59/5 * * * *'");
  expect(sql).toContain("hermesRoute=stalled");
  expect(sql).toContain('vault.decrypted_secrets');
  expect(sql).not.toContain('123456');
 });
 it('mantém a seleção de consulta em banco por empresa e sem alterar status de atendimento',()=>{
  const service=read('src/lib/hermes-return-service.ts');
  expect(service).toContain("rpc('hermes_claim_due_review'");
  expect(service).toContain("rpc('hermes_claim_stalled_review'");
  // Apenas campos de fonte e última movimentação oficial, nunca status ou retorno.\n  expect(service).toContain("from('processos').update(patch)");\n  const policy=read('src/lib/hermes-portfolio-evidence.ts');\n  expect(policy).not.toContain('proximo_retorno?:');\n  expect(policy).not.toContain('status_interno?:');
 });
});

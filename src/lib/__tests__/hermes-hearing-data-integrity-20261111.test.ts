import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {extrairAudienciasOficiais} from '@/lib/audiencias-monitor';
const sql=()=>readFileSync('supabase/migrations/20261111105000_hermes_hearing_integrity.sql','utf8');
describe('Integridade de pautas e sessões do Hermes',()=>{
 it('nunca interpreta prazo para oposição como data final de sessão e preserva início',()=>{
  const txt='PAUTA DE SESSÃO VIRTUAL DE JULGAMENTO. Sessão em 31/08/2026 às 00h00. Pedidos de destaque deverão ser apresentados até 18/08/2026.';
  const ev=extrairAudienciasOficiais(txt);
  expect(ev[0]?.data).toBe('2026-08-31');
  expect(ev[0]?.dataFim).toBeNull();
 });
 it('só elimina projeção inválida quando outro registro normalizado já cobre o mesmo processo e sessão',()=>{
  const ddl=sql();
  expect(ddl).toContain('DELETE FROM public.audiencias_monitoradas bad');
  expect(ddl).toContain('good.empresa_id=bad.empresa_id');
  expect(ddl).toContain('good.processo_id=bad.processo_id');
  expect(ddl).toContain('bad.data_fim < bad.data_evento');
  expect(ddl).toContain("good.chave=good.tipo||':'||good.data_evento::text||':'");
 });
 it('corrige chaves de sessão inconsistentes e veda fim anterior ao início em futuras gravações',()=>{
  const ddl=sql();
  expect(ddl).toContain('UPDATE public.audiencias_monitoradas a');
  expect(ddl).toContain('data_fim=NULL');
  expect(ddl).toContain('hora_fim=NULL');
  expect(ddl).toContain('ADD CONSTRAINT audiencias_monitoradas_end_after_start');
  expect(ddl).toContain('VALIDATE CONSTRAINT audiencias_monitoradas_end_after_start');
  expect(ddl).toContain('data_fim >= data_evento');
 });
 it('não adultera a evidência original de publicações nem dados de processo',()=>{
  const ddl=sql();
  expect(ddl).not.toMatch(/UPDATE\s+public\.processos/i);
  expect(ddl).not.toMatch(/DELETE\s+FROM\s+public\.hermes_portfolio_scans/i);
  expect(ddl).not.toMatch(/UPDATE\s+public\.hermes_portfolio_scans/i);
 });
});

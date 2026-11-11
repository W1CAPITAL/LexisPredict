import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {isAudienciaExpirada} from './audiencias-expiry';

describe('Expiração de audiências pelo horário de Brasília',()=>{
 const now=new Date('2026-11-11T14:00:00.000Z'); // 11:00 em São Paulo
 it('expira audiência cuja data final foi em dia anterior',()=>{
  expect(isAudienciaExpirada({data:'2026-11-04',dataFim:null},now)).toBe(true);
 });
 it('mantém sessão virtual que começou no passado mas termina no futuro',()=>{
  expect(isAudienciaExpirada({data:'2026-11-10',dataFim:'2026-11-12'},now)).toBe(false);
 });
 it('preserva eventos do dia atual mesmo quando há horário final legado',()=>{
  expect(isAudienciaExpirada({data:'2026-11-11',dataFim:'2026-11-11',horaFim:'10:30'},now)).toBe(false);
  expect(isAudienciaExpirada({data:'2026-11-11',dataFim:'2026-11-11',horaFim:'12:30'},now)).toBe(false);
 });
 it('não apaga evento de hoje sem horário final comprovado',()=>{
  expect(isAudienciaExpirada({data:'2026-11-11',dataFim:null,horaFim:null},now)).toBe(false);
 });
 it('usa o fuso local do tribunal para decidir se o último dia passou',()=>{
  const beforeMtEnd=new Date('2026-11-11T14:30:00.000Z'); // 08:30 em Mato Grosso
  expect(isAudienciaExpirada({data:'2026-11-11',dataFim:'2026-11-11',horaFim:'09:00',fuso:'MT'},beforeMtEnd)).toBe(false);
  expect(isAudienciaExpirada({data:'2026-11-10',fuso:'MT'},beforeMtEnd)).toBe(true);
 });
 it('não apaga designação sem data confirmada',()=>{
  expect(isAudienciaExpirada({data:null,dataFim:null},now)).toBe(false);
 });
 it('agenda a limpeza automática e restringe a limpeza manual à empresa autenticada',()=>{
  const migration=readFileSync('supabase/migrations/20261111122541_prune_hearings_after_local_day_20261111.sql','utf8');
  expect(migration).toContain('p_empresa_id IS NULL OR empresa_id=p_empresa_id');
  expect(migration).toContain("'America/Sao_Paulo'");
  expect(migration).toContain("'America/Cuiaba'");
  expect(migration).toContain('COALESCE(a.data_fim,a.data_evento) <');
  expect(migration).not.toContain('hora_fim))::time <= local_clock');
  expect(migration).toContain("'lexis-hermes-prune-past-hearings'");
  expect(migration).toContain("'*/15 * * * *'");
  expect(migration).toContain('GRANT EXECUTE');
  expect(migration).toContain('TO service_role');
 });
});

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
 it('expira evento de hoje somente quando o horário final conhecido já passou',()=>{
  expect(isAudienciaExpirada({data:'2026-11-11',dataFim:'2026-11-11',horaFim:'10:30'},now)).toBe(true);
  expect(isAudienciaExpirada({data:'2026-11-11',dataFim:'2026-11-11',horaFim:'12:30'},now)).toBe(false);
 });
 it('não apaga evento de hoje sem horário final comprovado',()=>{
  expect(isAudienciaExpirada({data:'2026-11-11',dataFim:null,horaFim:null},now)).toBe(false);
 });
 it('não apaga designação sem data confirmada',()=>{
  expect(isAudienciaExpirada({data:null,dataFim:null},now)).toBe(false);
 });
 it('agenda a limpeza automática e restringe a limpeza manual à empresa autenticada',()=>{
  const migration=readFileSync('supabase/migrations/20261111145000_prune_expired_audiencias.sql','utf8');
  expect(migration).toContain('p_empresa_id IS NULL OR empresa_id=p_empresa_id');
  expect(migration).toContain("'America/Sao_Paulo'");
  expect(migration).toContain("'lexis-hermes-prune-past-hearings'");
  expect(migration).toContain("'*/15 * * * *'");
  expect(migration).toContain('GRANT EXECUTE');
  expect(migration).toContain('TO service_role');
 });
});

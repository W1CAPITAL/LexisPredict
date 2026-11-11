import {describe,it,expect} from 'vitest';
import {listCompanyDueReturns} from './company-return-queue';

const today='2026-11-11';
const base=(id:number,overrides:Record<string,unknown>={})=>({
 id:String(id),db_id:String(id),cliente:'Cliente '+id,protocolo:'0000000-00.2026.8.26.0000',
 status:'No Prazo',status_interno:'EM ANDAMENTO',ultimoRetorno:'2026-11-04',
 proximoPrazo:today,created_by:'outro-colaborador',empresa_id:'empresa-compartilhada',
 ...overrides,
} as any);

describe('Fila empresarial de retornos',()=>{
 it('inclui TODOS os processos ativos com retorno hoje, mesmo quando o último atendimento foi há menos de 20 dias',()=>{
  const rows=[
   base(1,{ultimoRetorno:'2026-11-04'}),
   base(2,{ultimoRetorno:'2026-10-21'}),
   base(3,{ultimoRetorno:'2026-10-27'}),
   base(4,{ultimoRetorno:'2026-11-04'}),
   base(5,{ultimoRetorno:'2026-11-05'}),
  ];
  const result=listCompanyDueReturns(rows,today);
  expect(result).toHaveLength(5);
  expect(result.map(x=>x.process.id)).toEqual(['1','2','3','4','5']);
  expect(result.every(x=>x.kind==='today')).toBe(true);
 });
 it('não exige último atendimento preenchido quando o próximo retorno está marcado para hoje',()=>{
  const result=listCompanyDueReturns([base(6,{ultimoRetorno:null})],today);
  expect(result).toHaveLength(1);
  expect(result[0].lastContact).toBe('');
 });
 it('inclui processo criado por outro colaborador da mesma empresa',()=>{
  const result=listCompanyDueReturns([base(7,{created_by:'colaborador-diferente'})],today);
  expect(result.map(x=>x.process.id)).toEqual(['7']);
 });
 it('mantém somente processos ativos com data de retorno válida até hoje',()=>{
  const result=listCompanyDueReturns([
   base(8,{status_interno:'ENCERRADO'}),
   base(9,{proximoPrazo:'2026-11-12'}),
   base(10,{proximoPrazo:'data inválida'}),
   base(11,{proximoPrazo:'2026-11-10'}),
  ],today);
  expect(result.map(x=>x.process.id)).toEqual(['11']);
 });
});

import {describe,it,expect} from 'vitest';
import {getTribunalFromCnj} from '@/lib/tribunais-cnj';
import {getTribunalByCnj} from '@/lib/tribunais-links';
const cnj=(justice:string,code:string)=>'1234567892026'+justice+code+'0001';

describe('Atalhos do tribunal nunca trocam ramos da Justiça',()=>{
 it('TJSP pelo ramo 8 continua em eproc, com e-SAJ como alternativa',()=>{
  const tj=getTribunalFromCnj(cnj('8','26'));
  expect(tj?.nome).toBe('TJSP');
  expect(getTribunalByCnj(cnj('8','26'))?.alternativos?.some(x=>x.sistema==='esaj')).toBe(true);
 });
 it('TRT2 não é TJAL, TRF3 não é TJAP e STJ não é tribunal estadual',()=>{
  expect(getTribunalFromCnj(cnj('5','02'))).toBeNull();
  expect(getTribunalFromCnj(cnj('4','03'))).toBeNull();
  expect(getTribunalFromCnj(cnj('2','00'))).toBeNull();
  expect(getTribunalByCnj(cnj('5','02'))?.sigla).toBe('TRT2');
  expect(getTribunalByCnj(cnj('4','03'))?.sigla).toBe('TRF3');
  expect(getTribunalByCnj(cnj('4','05'))?.sigla).toBe('TRF5');
  expect(getTribunalByCnj(cnj('2','00'))?.sigla).toBe('STJ');
 });
});

import {describe,it,expect} from 'vitest';
import {COURT_ALIASES,resolveDataJudAlias} from '@/lib/datajud';

const cnj=(justice:string,tribunal:string)=>'1234567892026'+justice+tribunal+'0001';

describe('DataJud: alias oficial a partir da numeração CNJ',()=>{
 it('não confunde CNJ, STJ e TST',()=>{
  expect(resolveDataJudAlias(cnj('2','00'))).toBeNull();
  expect(resolveDataJudAlias(cnj('3','00'))).toBe('stj');
  expect(resolveDataJudAlias(cnj('5','00'))).toBe('tst');
  expect(resolveDataJudAlias(cnj('1','00'))).toBeNull();
 });

 it('mapeia todos os 27 TREs na ordem oficial da numeração CNJ',()=>{
  const expected=['tre-ac','tre-al','tre-am','tre-ap','tre-ba','tre-ce','tre-dft','tre-es','tre-go',
   'tre-ma','tre-mt','tre-ms','tre-mg','tre-pa','tre-pb','tre-pr','tre-pe','tre-pi','tre-rj',
   'tre-rn','tre-rs','tre-ro','tre-rr','tre-sc','tre-se','tre-sp','tre-to'];
  expected.forEach((alias,index)=>{
   const code=String(index+1).padStart(2,'0');
   expect(COURT_ALIASES['6.'+code]).toBe(alias);
   expect(resolveDataJudAlias(cnj('6',code))).toBe(alias);
  });
  expect(resolveDataJudAlias(cnj('6','00'))).toBe('tse');
 });

 it('mapeia as 12 circunscrições da Justiça Militar da União ao índice STM',()=>{
  expect(resolveDataJudAlias(cnj('7','00'))).toBe('stm');
  for(let i=1;i<=12;i++){
   expect(resolveDataJudAlias(cnj('7',String(i).padStart(2,'0')))).toBe('stm');
  }
 });

 it('mapeia os três Tribunais de Justiça Militar estaduais',()=>{
  expect(resolveDataJudAlias(cnj('9','13'))).toBe('tjmmg');
  expect(resolveDataJudAlias(cnj('9','21'))).toBe('tjmrs');
  expect(resolveDataJudAlias(cnj('9','26'))).toBe('tjmsp');
  expect(resolveDataJudAlias(cnj('9','12'))).toBeNull();
 });

 it('não inventa endpoint para códigos sem alias público documentado',()=>{
  expect(resolveDataJudAlias(cnj('4','90'))).toBeNull();
  expect(resolveDataJudAlias(cnj('5','90'))).toBeNull();
  expect(resolveDataJudAlias(cnj('8','99'))).toBeNull();
  expect(resolveDataJudAlias('123')).toBeNull();
 });
});

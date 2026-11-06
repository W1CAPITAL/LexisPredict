import {describe,it,expect} from 'vitest';
import {extractCnjFromPastedPortalResults} from './oab-discovery';

const first='0829229-82.2024.8.19.0209';
const second='0800086-70.2025.8.19.0255';
describe('Descoberta assistida por OAB: importação por texto',()=>{
 it('extrai números CNJ válidos, na ordem, sem duplicar',()=>{
  const result=extractCnjFromPastedPortalResults('Processos: '+first+'; '+second+'; repetido: '+first);
  expect(result.numbers).toEqual([first,second]);
  expect(result.duplicates).toBe(1);
  expect(result.invalid).toBe(0);
 });
 it('rejeita erro de dígito e não lê um CNJ de dentro de uma sequência maior',()=>{
  const result=extractCnjFromPastedPortalResults('0829229-83.2024.8.19.0209 e 1'+first.replace(/\D/g,'')+'1');
  expect(result.numbers).toEqual([]);
  expect(result.invalid).toBe(1);
 });
 it('indica listagem parcial quando o limite é excedido',()=>{
  const result=extractCnjFromPastedPortalResults(first+' '+second,1);
  expect(result.numbers).toEqual([first]);
  expect(result.truncated).toBe(true);
 });
 it('não inventa resultados para texto vazio',()=>{
  expect(extractCnjFromPastedPortalResults('').numbers).toEqual([]);
 });
});

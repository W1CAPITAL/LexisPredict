import {describe,it,expect} from 'vitest';
import {cnjDvValido,cnjEstruturaPlausivel} from './cnj-higiene';

describe('CNJ: dígito verificador oficial (Resolução CNJ 65/2008)',()=>{
 it('aceita dois números válidos do conjunto de regressão do MAAT Monitor',()=>{
  expect(cnjDvValido('0829229-82.2024.8.19.0209')).toBe(true);
  expect(cnjDvValido('0800086-70.2025.8.19.0255')).toBe(true);
  expect(cnjEstruturaPlausivel('08292298220248190209').ok).toBe(true);
 });
 it('rejeita dígito modificado, tamanho incorreto e sequência vazia',()=>{
  expect(cnjDvValido('0829229-83.2024.8.19.0209')).toBe(false);
  expect(cnjDvValido('123')).toBe(false);
  expect(cnjDvValido('00000000000000000000')).toBe(false);
 });
});

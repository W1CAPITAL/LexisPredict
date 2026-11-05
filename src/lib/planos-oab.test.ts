import {describe,it,expect} from 'vitest';
import {hrefLiberado,filterNavByPlan} from './planos-pacotes';

describe('Consulta OAB gratuita na navegação',()=>{
 it('exibe a consulta em planos que não possuem o scanner DataJud pago',()=>{
  for(const plan of ['essencial','operacional','financeiro','maximo'] as const){
   expect(hrefLiberado('/consulta-oab',plan)).toBe(true);
   const routes=filterNavByPlan([{href:'/consulta-oab'},{href:'/settings'}],plan);
   expect(routes.some(route=>route.href==='/consulta-oab')).toBe(true);
  }
 });
 it('mantém o bloqueio das rotas premium não relacionadas',()=>{
  expect(hrefLiberado('/superadmin','essencial')).toBe(false);
 });
});
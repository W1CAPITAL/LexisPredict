import {describe,expect,it} from 'vitest';
import {nextAutoListCount} from './auto-list-pagination';

describe('paginação progressiva automática',()=>{
 it('avança em lotes sem exigir cliques repetidos',()=>{
  expect(nextAutoListCount(24,200,48)).toBe(72);
  expect(nextAutoListCount(72,200,48)).toBe(120);
 });
 it('nunca ultrapassa o total disponível',()=>{
  expect(nextAutoListCount(180,200,48)).toBe(200);
  expect(nextAutoListCount(200,200,48)).toBe(200);
 });
 it('normaliza valores inválidos e limites negativos',()=>{
  expect(nextAutoListCount(-10,50,10)).toBe(10);
  expect(nextAutoListCount(10,-1,10)).toBe(0);
  expect(nextAutoListCount(10,50,0)).toBe(11);
 });
});

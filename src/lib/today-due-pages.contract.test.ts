import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';

describe('Dashboard e fila consultam o mesmo total acionável',()=>{
 it('ambas as páginas usam o helper compartilhado',()=>{
  const dashboard=readFileSync('src/app/page.tsx','utf8');
  const tasks=readFileSync('src/app/tarefas/page.tsx','utf8');
  expect(dashboard).toContain('summarizeActionableDueCases(allCases');
  expect(tasks).toContain('summarizeActionableDueCases(todayDueCases??[])');
 });
 it('paginação nunca encerra silenciosamente ao alcançar o limite',()=>{
  const dashboard=readFileSync('src/app/page.tsx','utf8');
  const tasks=readFileSync('src/app/tarefas/page.tsx','utf8');
  expect(dashboard).toContain('loadAllDuePages(');
  expect(tasks).toContain('loadAllDuePages(');
  expect(tasks).not.toContain('while(hasMore&&offset<5000');
 });
});

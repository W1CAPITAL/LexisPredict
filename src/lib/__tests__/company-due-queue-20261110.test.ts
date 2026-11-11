import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {listCompanyDueReturns} from '@/lib/company-return-queue';
import type {LegalCase} from '@/lib/case-logic';
const read=(p:string)=>readFileSync(p,'utf8');
const caseOf=(id:string,last:string,next:string,more:Record<string,unknown>={})=>
 ({id,db_id:id,cliente:'Cliente '+id,protocolo:'1002670-83.2025.8.26.0271',
   ultimoRetorno:last,proximoPrazo:next,status:'No Prazo',situacao:'EM ANDAMENTO',
   advogado:'Advogado',escritorio:'Escritório',...more}) as unknown as LegalCase;

describe('Fila unificada de retornos da empresa',()=>{
 it('considera apenas retorno vencido válido ou agendado para hoje, sem inventar vencimentos',()=>{
  const cases=[
   caseOf('1','2026-11-06','2026-11-09'),
   caseOf('2','2026-10-01','2026-11-12'),
   caseOf('3','2026-10-01','2026-11-09'),
   caseOf('4','2026-10-01','2026-11-10'),
   caseOf('5','2026-10-01','2026-11-08',{situacao:'ENCERRADO'}),
   caseOf('6','','2026-11-09'),
  ];
  const result=listCompanyDueReturns(cases,'2026-11-10');
  expect(result.map(x=>x.process.id).sort()).toEqual(['1','3','4','6']);
  expect(result.find(x=>x.process.id==='4')?.kind).toBe('today');
  expect(result.filter(x=>x.kind==='overdue')).toHaveLength(3);
 });
 it('prioriza movimento judicial relevante acima da rotina e desempata pelo atraso',()=>{
  const cases=[
   caseOf('a','2026-10-01','2026-11-09'),
   caseOf('b','2026-10-01','2026-11-08',{tem_atualizacao_pos_retorno:true}),
   caseOf('c','2026-10-01','2026-11-04'),
  ];
  const results=listCompanyDueReturns(cases,'2026-11-10');
  expect(results[0].process.id).toBe('b');
  expect(results[1].process.id).toBe('c');
  expect(results[2].process.id).toBe('a');
 });
 it('não considera tarefas vencidas ou situação de CRM como retorno por si sós',()=>{
  expect(listCompanyDueReturns([caseOf('1','2026-11-06','2026-12-06',{status:'Vencido'})],'2026-11-10')).toHaveLength(0);
 });
 it('mantém duas rotas com a mesma fila, busca integral por empresa e botão Hermes',()=>{
  const tasks=read('src/app/tarefas/page.tsx');
  const cases=read('src/app/cases/page.tsx');
  const queue=read('src/components/returns/company-due-queue.tsx');
  for(const page of [tasks,cases])expect(page).toMatch(/return\\s*<CompanyDueQueue\\s*\\/>/);
  expect(queue).toContain("field: 'proximo-retorno'");
  expect(queue).toContain('loadAllDuePages');
  expect(queue).toContain('HermesReturnReviewButton');
  expect(queue).not.toContain("scope: 'mine'");
 });
 it('remove encerrados em revisão dos menus e da página inicial',()=>{
  for(const p of ['sidebar-vertical.tsx','src/components/layout/sidebar-dock.tsx','src/app/page.tsx'])
   expect(read(p)).not.toMatch(/EncerradosRevisaoQueue|href:\s*['\"]\/encerrados-revisao['\"]|\['Encerrados',\s*'\/encerrados-revisao'/);
 });
 it('treina a fila empresarial, Hermes automático de parados e diferença entre parados e vencidos',()=>{
  const tour=read('src/components/onboarding/guided-tour.tsx');
  const onboarding=read('src/app/onboarding/page.tsx');
  expect(tour).toContain('Processos parados');
  expect(tour).toContain('/processos');
  expect(tour).toContain('retorno vencido');
  expect(onboarding).toContain('Hermes');
  expect(onboarding).toContain('toda a empresa');
 });
});
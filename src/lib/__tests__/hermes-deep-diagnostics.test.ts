import { describe,it,expect } from 'vitest';
import {readFileSync} from 'node:fs';
import {diagnosticsSections,normalizeHermesDiagnostics,type HermesPortfolioDiagnostics} from '@/lib/hermes-diagnostics-policy';
const source=(file:string)=>readFileSync(file,'utf8');

const summary:HermesPortfolioDiagnostics={
 day:'2026-11-10',generatedAt:'2026-11-10T12:00:00.000Z',total:50,active:12,closed:38,
 overdueReturns:2,registeredDeadlinesDue:1,staleSources:5,missingLawyer:1,missingOffice:2,
 critical:1,attention:4,monitoring:7,averageHealth:69,sourceErrors:3,
 closedWithOpenTask:2,openCrmTasks:8,overdueCrmTasks:3,completedHumanTasks30d:11,
 contactsConfirmed30d:7,unconfirmedOutcomes:3,
 merits:{improcedenteIndicada:4,procedenteIndicada:3,parcialIndicada:2,indeterminado:41,flagWithoutEvidence:7},
 byLawyer:[{name:'Advogado Exemplo',total:8,active:3,critical:1,overdue:1,avgHealth:72,sourceGaps:2}],
 byOffice:[{name:'Escritório A',total:20,active:6,critical:1,overdue:1,avgHealth:75,sourceGaps:2}],
 byUser:[{name:'Colaborador',role:'Operador',done30d:11,contacts30d:7,distinctCases:5,openTasks:3,overdueTasks:2}],
 topCases:[{processId:11,client:'Cliente',cnj:'123',lawyer:'Advogado Exemplo',office:'Escritório A',
   severity:'Crítica',score:90,health:10,status:'EM ANDAMENTO',outcome:'não determinado',reasons:['Retorno vencido'],nextReturn:'2026-11-08'}],
 taskQueue:[{title:'Conferir prazo',assignee:'Colaborador',dueOn:'2026-11-08',done:false,occurrences:3}],
 recommendations:[{priority:'Alta',sector:'Processos',title:'Reconsultar DataJud',reason:'3 falhas',action:'Verificar consulta oficial',automated:false}],
 learning:{previousDay:null,healthDelta:null,overdueDelta:null,sourceGapDelta:null,revision:'regra 1'},
};

describe('Hermes portfolio diagnostics audit',()=>{
 it('separates registered merits from confirmed court outcomes',()=>{
  const d=normalizeHermesDiagnostics(summary);
  expect(d.merits.flagWithoutEvidence).toBe(7);
  expect(d.merits.improcedenteIndicada).toBe(4);
  expect(d).not.toHaveProperty('winProbability');
 });
 it('creates PDF sections for lawyer, office, team, task queue, outcome evidence and highest risk processes',()=>{
  const s=diagnosticsSections(summary);
  const ids=s.map(x=>x.id);
  for(const id of ['hermes-operational-risks','hermes-outcome-audit','hermes-lawyers','hermes-offices',
   'hermes-people','hermes-task-queue','hermes-critical-cases','hermes-improvement'])expect(ids).toContain(id);
  expect(JSON.stringify(s)).toContain('Advogado Exemplo');
  expect(JSON.stringify(s)).toContain('Escritório A');
  expect(JSON.stringify(s)).toContain('Colaborador');
  expect(JSON.stringify(s)).toContain('Retorno vencido');
  expect(JSON.stringify(s)).not.toMatch(/ganhar|perder|% chance/i);
 });
 it('saves daily tenant-safe snapshots and schedules automatic refresh without duplicating serverless routes',()=>{
  const sql=source('supabase/migrations/20261110193000_hermes_deep_diagnostics.sql');
  expect(sql).toContain('hermes_portfolio_diagnostics');
  expect(sql).toContain('hermes_refresh_portfolio_diagnostics');
  expect(sql).toContain('enable row level security');
  expect(sql).toContain("p.dados->>'situacao'");
  expect(sql).toContain('cron.schedule');
  const route=source('src/app/api/cron/hermes-returns/route.ts');
  expect(route).toContain('getHermesPortfolioDiagnostics');
  expect(route).toContain('canReviewOffice(ctx)');
 });
 it('uses detailed evidence throughout report, supervision, 3D, official management PDF',()=>{
  expect(source('src/app/report/page.tsx')).toContain('getHermesPortfolioDiagnostics');
  expect(source('src/components/supervisao/hermes-supervisao-summary.tsx')).toContain('HermesPortfolioReport');
  expect(source('src/app/hermes-3d/page.tsx')).toContain('HermesPortfolioReport');
  expect(source('src/app/api/report/pdf/route.ts')).toContain('getHermesPortfolioDiagnostics');
  expect(source('src/components/pdf/report-team-summary-pdf.tsx')).toContain('hermesDiagnostics');
  expect(source('src/app/api/supervisao/pdf/route.ts')).toContain('getHermesPortfolioDiagnostics');
 });
});

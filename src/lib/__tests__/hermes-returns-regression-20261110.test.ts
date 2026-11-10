import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {classifyHermesReturnDate} from '@/lib/hermes-return-date';
import {buildHermesReturnReview} from '@/lib/hermes-return-policy';
import {buildHermesVerifiedMeeting,cleanHermesReportText} from '@/lib/hermes-verified-meeting';

const read=(p:string)=>readFileSync(p,'utf8');
describe('Hermes 10/11: return dates, incomplete sources and evidence-first reports',()=>{
 it('never marks a 0–3 day accidental reschedule overdue, even when stored date is yesterday',()=>{
  expect(classifyHermesReturnDate('2026-11-06','2026-11-09','2026-11-10')).toBe('inconsistent');
  expect(classifyHermesReturnDate('2026-11-05','2026-11-05','2026-11-10')).toBe('inconsistent');
  expect(classifyHermesReturnDate('2026-11-06','2026-12-06','2026-11-10')).toBe('upcoming');
  expect(classifyHermesReturnDate('2026-10-08','2026-11-10','2026-11-10')).toBe('today');
  expect(classifyHermesReturnDate('2026-10-08','2026-11-08','2026-11-10')).toBe('overdue');
  expect(classifyHermesReturnDate(null,'2026-11-09','2026-11-10')).toBe('unverifiable');
 });
 it('partial official lookup is not a completed verified review; no generic client message when datajud failed',()=>{
  const input={cliente:'MARIA',ultimoRetorno:'2026-11-06',proximoRetorno:'2026-11-09',today:'2026-11-10',status:'EM ANDAMENTO'};
  const result=buildHermesReturnReview(input,{djenOk:true,datajudOk:false,events:[]});
  expect(result.state).toBe('partial');
  expect(result.messageDraft).toBeNull();
  expect(result.highlights.some(h=>/DataJud/.test(h.source))).toBe(true);
 });
 it('allows a manually requested refresh even if the previous incomplete attempt is fresh',()=>{
  const route=read('src/app/api/cron/hermes-returns/route.ts');
  expect(route).not.toMatch(/const cacheMinutes=recent\?\.djen_ok/);
  expect(route).toContain("mode:'manual'");
  const service=read('src/lib/hermes-return-service.ts');
  expect(service).toContain('timeoutMs:');
  expect(service).toContain('forceRefresh: manual');
 });
 it('scheduler only claims return dates after minimum interval from actual last attendance',()=>{
  const migration=read('supabase/migrations/20261110200000_hermes_return_reliability.sql');
  expect(migration).toContain('hermes_claim_due_review');
  expect(migration).toContain('p.proximo_retorno-p.ultimo_retorno >= 20');
  expect(migration).toContain('hermes_refresh_office_daily');
  expect(migration).toContain('hermes_refresh_portfolio_diagnostics');
  expect(migration).toContain("'partial'");
 });
 it('meeting never includes Markdown junk or improvised legal claims; changes when underlying evidence changes',()=>{
  const m={total:100,active:33,overdue:0,alerts:4,staleSources:7,readyReviews:0,
    unavailableReviews:2,criticalReviews:0,draftMessages:0,completedActivities30d:10,contacts30d:2,checkedSources30d:1};
  const a=buildHermesVerifiedMeeting(m,'2026-11-10',{overdueReturns:0,registeredDeadlinesDue:0,
   staleSources:7,unmatchedAssigneeTasks:4,merits:{improcedenteIndicada:0,procedenteIndicada:0,parcialIndicada:0,indeterminado:100,flagWithoutEvidence:0},
   recommendations:[]});
  expect(a).toContain('Gerência:');
  expect(a).toContain('Supervisão:');
  expect(a).not.toMatch(/\*\*|CONFIRMADO|prazo legal|perdido|substitu[íi]/i);
  expect(buildHermesVerifiedMeeting({...m,staleSources:8},'2026-11-10',null)).not.toEqual(buildHermesVerifiedMeeting(m,'2026-11-10',null));
  expect(cleanHermesReportText('**Resumo** | coluna |\n# título')).not.toContain('**');
 });
 it('Hermes legal pdf is tenant protected, paginated, and does not dump raw Markdown',()=>{
  const src=read('src/components/pdf/hermes-legal-pdf.tsx');
  expect(src).toContain("size=\"A4\"");
  expect(src).toContain('fixed');
  expect(src).toContain('cleanHermesReportText');
  const api=read('src/app/api/cron/hermes-returns/route.ts');
  expect(api).toContain("format')==='pdf'");
  expect(api).toContain('canReviewOffice');
  expect(read('src/components/hermes/hermes-export.tsx')).toContain('/api/hermes-office?format=pdf');
 });
 it('Hermes no longer labels administrative CRM tasks as overdue and hides invalid return review from current queue',()=>{
  const screen=read('src/components/report/hermes-portfolio-report.tsx');
  const pdf=read('src/lib/hermes-diagnostics-policy.ts');
  expect(screen).not.toMatch(/Tarefas CRM vencidas|Vencidas sem vínculo|Tarefas vencidas/);
  expect(pdf).not.toMatch(/Tarefas abertas\/vencidas|Vencidas sem vínculo/);
  expect(read('src/app/actions/hermes-return-actions.ts')).toContain('classifyHermesReturnDate');
  expect(read('src/lib/hermes-company-service.ts')).toContain('classifyHermesReturnDate');
 });
});

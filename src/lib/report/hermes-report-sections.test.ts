import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { buildHermesPdfSections } from '@/lib/report/hermes-report-sections';
import type { HermesOfficeDailyRow } from '@/lib/hermes-company-service';
import type { HermesCaseHealth } from '@/lib/hermes-company-intelligence';

const row:HermesOfficeDailyRow={
 empresa_id:'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',day:'2026-11-10',
 metrics:{
  total:55,active:41,overdue:6,alerts:3,staleSources:7,
  readyReviews:9,unavailableReviews:2,criticalReviews:1,
  draftMessages:4,completedActivities30d:27,contacts30d:13,checkedSources30d:16,
 },
 meeting_note:'Equipe identificou sete cadastros sem atualização de fonte. Conferir consultas oficiais antes de responder clientes.',
 meeting_engine:'cascata-superagente',meeting_status:'ready',updated_at:'2026-11-10T13:10:00.000Z',
};
const cases:HermesCaseHealth[]=Array.from({length:16},(_,i)=>({
 processId: i+1,client:'Cliente '+(i+1),cnj:'1000000-11.2026.8.26.000'+i,
 priorityScore:91,priorityLabel:'Alta',djenOk:true,datajudOk:false,
 checkedAt:'2026-11-10T11:00:00.000Z',dueOn:'2026-11-11',
 level:'Revisão urgente',sourceStatus:'DataJud sem confirmação',
}));

describe('Hermes reports across supervisors and export PDFs',()=>{
 it('does not invent a report when no authorized snapshot was recorded',()=>{
  expect(buildHermesPdfSections(null,[])).toEqual([]);
 });
 it('includes verified numbers, notes and a bounded list of case findings',()=>{
  const sections=buildHermesPdfSections(row,cases);
  expect(sections.map(x=>x.id)).toEqual(['hermes-kpis','hermes-meeting','hermes-cases']);
  expect(sections[0]).toMatchObject({kind:'metrics'});
  expect(JSON.stringify(sections)).toContain('27');
  expect(JSON.stringify(sections)).toContain('Equipe identificou sete cadastros');
  expect(JSON.stringify(sections)).toContain('DataJud sem confirmação');
  expect(sections[2].kind==='table'&&sections[2].rows.length).toBeLessThanOrEqual(8);
  expect(JSON.stringify(sections)).not.toMatch(/winProbability|lossProbability|staffEquivalent/i);
 });
 it('labels unavailable AI output correctly instead of presenting it as a completed meeting',()=>{
  const sections=buildHermesPdfSections({...row,meeting_status:'pending',meeting_note:null,meeting_engine:null},[]);
  expect(JSON.stringify(sections)).not.toContain('Equipe identificou');
  expect(JSON.stringify(sections)).toContain('Ainda não');
  expect(sections.map(x=>x.id)).toEqual(['hermes-kpis','hermes-meeting']);
 });
 it('reports Hermes in both official PDF exports and the supervisor page, without leaking company scope to personal PDF',()=>{
  const pdfReport=readFileSync('src/app/api/report/pdf/route.ts','utf8');
  const pdfSupervisor=readFileSync('src/app/api/supervisao/pdf/route.ts','utf8');
  const supervisorPage=readFileSync('src/app/supervisao/page.tsx','utf8');
  expect(pdfReport).toContain('getHermesCompanyDaily');
  expect(pdfReport).toContain('getHermesCaseHealth');
  expect(pdfReport).toMatch(/owner\s*\?\s*null\s*:/);
  expect(pdfSupervisor).toContain('getHermesCompanyDaily');
  expect(pdfSupervisor).toContain('getHermesCaseHealth');
  expect(supervisorPage).toContain('HermesSupervisaoSummary');
 });
});

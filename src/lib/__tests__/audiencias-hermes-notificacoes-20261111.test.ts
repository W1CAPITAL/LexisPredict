import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {mergeHearingEvidence} from '@/lib/audiencias-source-priority';

const stored={
 fonte:'DJEN',situacao:'publicada',tipo:'conciliacao',
 data_evento:'2026-11-19',hora_local:'13:00',
 modalidade:'virtual',meeting_url:'https://teams.microsoft.com/l/meetup-join/hello',
 evidencia:'Audiência de conciliação designada para 19/11/2026 às 13:00'
};
const incoming={
 fonte:'DataJud',situacao:'publicada',tipo:'conciliacao',data_evento:'2026-11-19',
 hora_local:null,modalidade:'nao_informada',meeting_url:null,evidencia:'Audiência designada'
};
describe('Hermes · audiências e preservação de notificações',()=>{
 it('não rebaixa DJEN e não perde o link Teams quando DataJud traz metadados incompletos',()=>{
  expect(mergeHearingEvidence(stored,incoming)).toBeNull();
 });
 it('oficial DJEN confirma a notificação, preserva horário informado até nova evidência, e não inventa reunião',()=>{
  const before={...incoming,fonte:'NOTIFICACAO',situacao:'informada',hora_local:'10:00',modalidade:'virtual'};
  const newOfficial={...incoming,fonte:'DJEN',situacao:'publicada',hora_local:null,modalidade:'nao_informada'};
  expect(mergeHearingEvidence(before,newOfficial)).toMatchObject({
   fonte:'DJEN',situacao:'publicada',hora_local:'10:00',modalidade:'virtual',meeting_url:null
  });
 });
 it('reconsultas da mesma fonte preservam link e horário existentes quando resposta é parcial',()=>{
  const result=mergeHearingEvidence(stored,{...incoming,fonte:'DJEN'});
  expect(result).toMatchObject({fonte:'DJEN',meeting_url:stored.meeting_url,hora_local:'13:00',modalidade:'virtual'});
 });
 it('comunicado nunca substitui data oficialmente confirmada',()=>{
  expect(mergeHearingEvidence(stored,{...incoming,fonte:'NOTIFICACAO',situacao:'informada'})).toBeNull();
 });
 it('rotina de audiência usa o limitador compartilhado e não consulta DataJud diretamente em 6,5s',()=>{
  const s=readFileSync('src/lib/audiencias-service.ts','utf8');
  const start=s.indexOf('export async function verificarUmaAudienciaAgendada()');
  const body=s.slice(start);
  expect(body).toContain('requestDataJudWithCapacity');
  expect(body).toContain('25_000');
  expect(body).not.toContain('timeoutMs:6500');
  expect(body).not.toContain('fetchDataJud(cnj');
  expect(s).toContain('mergeHearingEvidence');
 });
 it('cron de 10 minutos reutiliza a função Hermes existente, sem função extra na Vercel',()=>{
  const route=readFileSync('src/app/api/cron/hermes-returns/route.ts','utf8');
  const sql=readFileSync('supabase/migrations/20261111190500_hermes_hearing_cron.sql','utf8');
  expect(route).toContain("mode === 'hearings'");
  expect(route).toContain('verificarUmaAudienciaAgendada()');
  expect(sql).toContain("lexis-hermes-hearing-monitor");
  expect(sql).toContain("'*/10 * * * *'");
  expect(sql).toContain('hermesRoute=hearings');
 });
 it('a aba de audiências distingue comunicados de atos oficiais',()=>{
  const ui=readFileSync('src/app/audiencias/page.tsx','utf8');
  expect(ui).toContain('Notificação recebida');
  expect(ui).toContain('aguarda confirmação no tribunal');
  expect(ui).toContain('resolv');
 });
});

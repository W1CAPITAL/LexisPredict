/** Compartilhado por /report, /supervisao e ambos os exportadores PDF.
 * Relata somente evidências persistidas e nunca calcula chance de êxito judicial. */
import { buildHermesOfficeIntelligence, type HermesCaseHealth } from '@/lib/hermes-company-intelligence';
import type { HermesOfficeDailyRow } from '@/lib/hermes-company-service';
import { REPORT_COLORS, reportDate, type ReportSection } from '@/lib/report/visual-report';

function safeLine(value:unknown, limit=420):string {
 return String(value??'').replace(/[\u0000-\u001f]/g,' ').replace(/\s+/g,' ').trim().slice(0,limit);
}

export function buildHermesPdfSections(row:HermesOfficeDailyRow|null,cases:HermesCaseHealth[]):ReportSection[]{
 if(!row || !row.metrics || typeof row.metrics !== 'object') return [];
 const office=buildHermesOfficeIntelligence(row.metrics,row.day);
 const m=office.counters;
 const day=reportDate(row.day);
 const meetingStatus=row.meeting_status==='ready' && row.meeting_note
   ? 'Síntese registrada: '+safeLine(row.meeting_note,700)
   :row.meeting_status==='unavailable' && row.meeting_note
     ? 'IA indisponível; síntese por regras: '+safeLine(row.meeting_note,700)
     :'Ainda não há reunião consolidada para esta data.';
 const topRisks=office.risks.slice(0,2).map(r=>r.label+': '+safeLine(r.detail,190));
 const sections:ReportSection[]=[
  {id:'hermes-kpis',kind:'metrics',title:'Hermes · indicadores verificados',subtitle:'Consolidação de '+day+' — registros históricos e situação operacional, não probabilidades judiciais.',
   metrics:[
    {label:'Ativos no CRM',value:m.active,color:REPORT_COLORS.teal},
    {label:'Retornos vencidos',value:m.overdue,color:REPORT_COLORS.red},
    {label:'Revisões prontas',value:m.readyReviews,color:REPORT_COLORS.blue},
    {label:'Fontes a conferir',value:m.staleSources,color:REPORT_COLORS.gold},
    {label:'Atividades · 30 dias',value:m.completedActivities30d,color:REPORT_COLORS.purple},
    {label:'Rascunhos revisáveis',value:m.draftMessages,color:REPORT_COLORS.gold},
   ]},
  {id:'hermes-meeting',kind:'notes',title:'Hermes · ata e gargalos',subtitle:'Reunião registrada e encaminhamentos dos setores, sujeitos a revisão de fontes.',
   items:[`Saúde operacional: ${office.health}. ${m.unavailableReviews} revisões sem confirmação completa.`,
    ...topRisks,
    meetingStatus,
    'Medalhas representam somente registros; não medem equivalência a funcionários nem prognóstico de vitória judicial.',
   ]},
 ];
 const selected=(Array.isArray(cases)?cases:[]).slice(0,8);
 if(selected.length){
  sections.push({
   id:'hermes-cases',kind:'table',title:'Hermes · processos para conferência',
   subtitle:'Amostra das últimas revisões da empresa, limitada a oito registros. Fonte ausente não significa ausência de movimentação.',
   columns:['Cliente','CNJ','Urgência operacional','Verificação judicial'],
   rows:selected.map(c=>[
    safeLine(c.client,70),safeLine(c.cnj||'Não informado',42),
    safeLine(c.level,45),safeLine(c.sourceStatus,90),
   ]),
  });
 }
 return sections;
}

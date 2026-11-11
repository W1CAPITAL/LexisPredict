/** Compartilhado por /report, /supervisao e ambos os exportadores PDF.
 * Relata somente evidências persistidas e nunca calcula chance de êxito judicial. */
import { buildHermesOfficeIntelligence, type HermesCaseHealth } from '@/lib/hermes-company-intelligence';
import type { HermesOfficeDailyRow,HermesPortfolioCaseSummary } from '@/lib/hermes-company-service';
import {diagnosticsSections,type HermesPortfolioDiagnostics} from '@/lib/hermes-diagnostics-policy';
import { REPORT_COLORS, reportDate, type ReportSection } from '@/lib/report/visual-report';
import {cleanHermesReportText} from '@/lib/hermes-verified-meeting';

function safeLine(value:unknown, limit=420):string {
 return cleanHermesReportText(value).replace(/\s+/g,' ').trim().slice(0,limit);
}

export function buildHermesPdfSections(row:HermesOfficeDailyRow|null,cases:HermesCaseHealth[],diagnostics:HermesPortfolioDiagnostics|null=null,portfolioScans:HermesPortfolioCaseSummary[]=[]):ReportSection[]{
 if(!row || !row.metrics || typeof row.metrics !== 'object') return diagnosticsSections(diagnostics);
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
    {label:'Retornos vencidos válidos',value:diagnostics?.overdueReturns??m.overdue,color:REPORT_COLORS.red},
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
 const recent=portfolioScans.slice(0,12);
 if(recent.length){
  sections.push({
   id:'hermes-judicial-evidence',kind:'table',title:'Hermes · histórico e indícios judiciais',
   subtitle:'Amostra de consultas oficiais da empresa. Publicação DJEN não é histórico integral; rótulos de decisão e custas exigem o teor.',
   columns:['Cliente / CNJ','Fontes','Resultado extraído','Consulta'],
   rows:recent.map(s=>{
    const f=s.findings||{};
    const signals=[
      f.verdict?.value?'Mérito: '+f.verdict.value+' ('+f.verdict.source+')':null,
      f.hearings?.length?'Audiência: '+String(f.hearings[0].date||''):null,
      f.enforcement?.value?'Cumprimento: '+f.enforcement.value:null,
      f.attorneyFees?.value?'Sucumbência citada':null,
      f.legalAid?.value?'JG: '+f.legalAid.value:null,
      f.courtCosts?.value?'Custas citadas':null,
    ].filter(Boolean);
    return [
     safeLine(s.client,48)+' · '+safeLine(s.cnj,33),
     (s.datajudOk?'DataJud consultado':'DataJud pendente')+' / '+(s.djenOk?'DJEN consultado':'DJEN pendente'),
     safeLine(signals.join('; ')||'Sem sinal extraído',160),safeLine(s.checkedAt||'—',24),
    ];
   }),
  });
 }
 return [...sections,...diagnosticsSections(diagnostics)];
}

/** Hermes: tenant-scoped operational analytics, no courtroom win-rate forecasting.
 * Numbers are obtained from SQL audit snapshots; this file only validates and formats them. */
import {REPORT_COLORS,type ReportSection} from '@/lib/report/visual-report';

export type HermesDiagnosticGroup={name:string;total:number;active:number;critical:number;overdue:number;avgHealth:number;sourceGaps:number};
export type HermesDiagnosticUser={name:string;role:string;done30d:number;contacts30d:number;distinctCases:number;openTasks:number;overdueTasks:number};
export type HermesDiagnosticCase={
 processId:number;client:string;cnj:string;lawyer:string;office:string;severity:string;score:number;health:number;
 status:string;outcome:string;reasons:string[];nextReturn:string|null;
};
export type HermesDiagnosticTask={title:string;assignee:string;dueOn:string|null;done:boolean;occurrences:number};
export type HermesDiagnosticRecommendation={priority:string;sector:string;title:string;reason:string;action:string;automated:boolean};
export type HermesPortfolioDiagnostics={
 day:string;generatedAt:string;total:number;active:number;closed:number;
 overdueReturns:number;registeredDeadlinesDue:number;staleSources:number;
 missingLawyer:number;missingOffice:number;critical:number;attention:number;monitoring:number;
 averageHealth:number;sourceErrors:number;closedWithOpenTask:number;
 openCrmTasks:number;overdueCrmTasks:number;unmatchedAssigneeTasks?:number;unmatchedOverdueTasks?:number;
 completedHumanTasks30d:number;contactsConfirmed30d:number;
 unconfirmedOutcomes:number;
 merits:{improcedenteIndicada:number;procedenteIndicada:number;parcialIndicada:number;indeterminado:number;flagWithoutEvidence:number};
 byLawyer:HermesDiagnosticGroup[];byOffice:HermesDiagnosticGroup[];byUser:HermesDiagnosticUser[];
 topCases:HermesDiagnosticCase[];taskQueue:HermesDiagnosticTask[];recommendations:HermesDiagnosticRecommendation[];
 learning:{previousDay:string|null;healthDelta:number|null;overdueDelta:number|null;sourceGapDelta:number|null;revision:string};
};
const nonneg=(v:unknown)=>Number.isFinite(Number(v))?Math.max(0,Math.floor(Number(v))):0;
const limited=(v:unknown,n=110)=>String(v??'').replace(/[\u0000-\u001f]/g,' ').replace(/\s+/g,' ').trim().slice(0,n);
const arr=<T>(a:unknown):T[]=>Array.isArray(a)?a as T[]:[];

export function normalizeHermesDiagnostics(input:HermesPortfolioDiagnostics):HermesPortfolioDiagnostics{
 const value=input||{} as HermesPortfolioDiagnostics;
 return {
   ...value,day:limited(value.day,20),generatedAt:limited(value.generatedAt,45),
   total:nonneg(value.total),active:nonneg(value.active),closed:nonneg(value.closed),
   overdueReturns:nonneg(value.overdueReturns),registeredDeadlinesDue:nonneg(value.registeredDeadlinesDue),
   staleSources:nonneg(value.staleSources),missingLawyer:nonneg(value.missingLawyer),missingOffice:nonneg(value.missingOffice),
   critical:nonneg(value.critical),attention:nonneg(value.attention),monitoring:nonneg(value.monitoring),
   averageHealth:Math.min(100,nonneg(value.averageHealth)),sourceErrors:nonneg(value.sourceErrors),
   closedWithOpenTask:nonneg(value.closedWithOpenTask),openCrmTasks:nonneg(value.openCrmTasks),
   overdueCrmTasks:nonneg(value.overdueCrmTasks),
   unmatchedAssigneeTasks:nonneg(value.unmatchedAssigneeTasks),unmatchedOverdueTasks:nonneg(value.unmatchedOverdueTasks),
   completedHumanTasks30d:nonneg(value.completedHumanTasks30d),
   contactsConfirmed30d:nonneg(value.contactsConfirmed30d),unconfirmedOutcomes:nonneg(value.unconfirmedOutcomes),
   merits:{improcedenteIndicada:nonneg(value.merits?.improcedenteIndicada),
    procedenteIndicada:nonneg(value.merits?.procedenteIndicada),
    parcialIndicada:nonneg(value.merits?.parcialIndicada),
    indeterminado:nonneg(value.merits?.indeterminado),
    flagWithoutEvidence:nonneg(value.merits?.flagWithoutEvidence)},
   byLawyer:arr<HermesDiagnosticGroup>(value.byLawyer).slice(0,150),
   byOffice:arr<HermesDiagnosticGroup>(value.byOffice).slice(0,50),
   byUser:arr<HermesDiagnosticUser>(value.byUser).slice(0,150),
   topCases:arr<HermesDiagnosticCase>(value.topCases).slice(0,60),
   taskQueue:arr<HermesDiagnosticTask>(value.taskQueue).slice(0,60),
   recommendations:arr<HermesDiagnosticRecommendation>(value.recommendations).slice(0,18),
   learning:value.learning||{previousDay:null,healthDelta:null,overdueDelta:null,sourceGapDelta:null,revision:'Sem comparação anterior'},
 };
}
const cell=(value:unknown,n=95)=>limited(value,n)||'—';
const numeral=(v:unknown)=>nonneg(v).toLocaleString('pt-BR');

/** Produces paginated company-scoped PDF sections; no data from another tenant is fetched here. */
export function diagnosticsSections(raw:HermesPortfolioDiagnostics|null):ReportSection[]{
 if(!raw)return [];
 const d=normalizeHermesDiagnostics(raw);
 const out:ReportSection[]=[
  {id:'hermes-operational-risks',kind:'metrics',title:'Hermes · falhas, criticidade e saúde da carteira',
   subtitle:'Snapshot '+d.day+'. Saúde é pontuação de qualidade operacional (0–100), não prognóstico de êxito judicial.',
   metrics:[
    {label:'Carteira total',value:d.total,color:REPORT_COLORS.blue},
    {label:'Processos abertos',value:d.active,color:REPORT_COLORS.teal},
    {label:'Retornos vencidos ativos',value:d.overdueReturns,color:REPORT_COLORS.red},
    {label:'Datas de prazo no CRM a conferir',value:d.registeredDeadlinesDue,color:REPORT_COLORS.gold},
    {label:'Fontes desatualizadas',value:d.staleSources,color:REPORT_COLORS.gold},
    {label:'Casos com atenção alta',value:d.critical,color:REPORT_COLORS.red},
    {label:'Tarefas abertas/vencidas',value:d.openCrmTasks+' / '+d.overdueCrmTasks,color:REPORT_COLORS.purple},
    {label:'Tarefas sem vínculo na equipe',value:d.unmatchedAssigneeTasks||0,color:REPORT_COLORS.gold},
    {label:'Vencidas sem vínculo',value:d.unmatchedOverdueTasks||0,color:REPORT_COLORS.red},
    {label:'Saúde média operacional',value:d.averageHealth+'/100',color:REPORT_COLORS.teal},
    {label:'Atividades registradas em 30 dias',value:d.completedHumanTasks30d,color:REPORT_COLORS.blue},
   ]},
  {id:'hermes-outcome-audit',kind:'notes',title:'Hermes · resultados judiciais indicados e qualidade das evidências',
   subtitle:'Classificação pela justificativa cadastrada; não confirma trânsito em julgado, recursos ou recebimento.',
   items:[
    'Improcedência indicada no CRM: '+numeral(d.merits.improcedenteIndicada),
    'Procedência indicada no CRM: '+numeral(d.merits.procedenteIndicada),
    'Procedência parcial indicada no CRM: '+numeral(d.merits.parcialIndicada),
    'Sem classificação documental determinável: '+numeral(d.merits.indeterminado),
    'Flag positiva sem justificativa categorizável: '+numeral(d.merits.flagWithoutEvidence),
    'Os resultados oficiais confirmados devem ser conferidos individualmente no DataJud, DJEN e sentença; não são taxas de sucesso por advogado.',
   ]},
 ];
 if(d.byLawyer.length)out.push({
   id:'hermes-lawyers',kind:'table',title:'Hermes · carteira e alertas por advogado',
   subtitle:'Responsabilidade registrada no CRM, não ranking de capacidade profissional. Saúde média apenas dos processos abertos.',
   columns:['Advogado','Ativos / total','Críticos / retornos','Fontes sem atualização · saúde'],
   rows:d.byLawyer.map(x=>[cell(x.name,72),x.active+' / '+x.total,
     x.critical+' / '+x.overdue,x.sourceGaps+' · '+x.avgHealth+'/100'])
 });
 if(d.byOffice.length)out.push({
   id:'hermes-offices',kind:'table',title:'Hermes · pendências por escritório',
   subtitle:'Comparação das carteiras cadastradas; não usar as contagens sem controlar volume e perfil dos casos.',
   columns:['Escritório','Ativos / total','Críticos / vencidos','Fontes sem atualização · saúde'],
   rows:d.byOffice.map(x=>[cell(x.name,85),x.active+' / '+x.total,x.critical+' / '+x.overdue,
     x.sourceGaps+' · '+x.avgHealth+'/100'])
 });
 if(d.byUser.length)out.push({
   id:'hermes-people',kind:'table',title:'Hermes · produtividade individual e trabalho em equipe',
   subtitle:'Registros cadastrados em 30 dias, inclusive importações; quantidade não comprova contatos, horas ou trabalho manual.',
   columns:['Colaborador e cargo','Atividades 30d','Contatos confirmados','Tarefas abertas / vencidas'],
   rows:d.byUser.map(x=>[cell(x.name,55)+' · '+cell(x.role,35),x.done30d.toString(),
     x.contacts30d.toString(),x.openTasks+' / '+x.overdueTasks])
 });
 if(d.taskQueue.length)out.push({
   id:'hermes-task-queue',kind:'table',title:'Hermes · tarefas individuais e da equipe',
   subtitle:'Fila aberta atual do CRM; ocorrências mantêm o contador de repetições do cadastro.',
   columns:['Tarefa','Responsável','Data prevista','Ocorrências'],
   rows:d.taskQueue.map(x=>[cell(x.title,100),cell(x.assignee,60),cell(x.dueOn,30),String(x.occurrences)])
 });
 if(d.topCases.length)out.push({
   id:'hermes-critical-cases',kind:'table',title:'Hermes · processos com maior necessidade de revisão',
   subtitle:'Risco exclusivamente operacional, não chance de perder/ganhar a ação. Mostrar fonte e consultar a carteira.',
   columns:['Cliente / processo','Responsável','Criticidade · saúde','Motivo concreto'],
   rows:d.topCases.map(x=>[cell(x.client,45)+' · '+cell(x.cnj,35),cell(x.lawyer,70),
     x.severity+' · '+x.health+'/100',cell(x.reasons.join('; '),150)])
 });
 out.push({id:'hermes-improvement',kind:'notes',title:'Hermes · recomendações, prioridades e autoavaliação',
   subtitle:'Aprendizado por métricas persistidas; sugestões de alteração jurídica ou de código exigem validação.',
   items:[
    ...d.recommendations.map(x=>x.priority+' · '+x.sector+' / '+x.title+': '+x.reason+' Próxima ação: '+x.action),
    d.learning.previousDay
     ?'Comparação com '+d.learning.previousDay+': saúde '+String(d.learning.healthDelta??'—')+
       ', mudança em retornos vencidos '+String(d.learning.overdueDelta??'—')+
       ', mudança em fontes desatualizadas '+String(d.learning.sourceGapDelta??'—')+'.'
     :'Primeira coleta do período: comparação histórica disponível a partir do próximo snapshot diário.',
    'Não há autotreinamento de pesos de IA nem demissão automática; a promoção de mudanças requer testes e revisão.',
   ]});
 return out;
}

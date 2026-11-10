/** Projeção explicável do trabalho Hermes. Não é um veredito judicial nem simulação de pessoas substituídas. */
import { getHermesOfficeStations } from '@/lib/hermes-office';

export type HermesOfficeMetrics = {
  total: number; active: number; overdue: number; alerts: number; staleSources: number;
  readyReviews: number; unavailableReviews: number; criticalReviews: number;
  draftMessages: number; completedActivities30d: number; contacts30d: number;
  checkedSources30d: number;
};
export type HermesOfficeRisk = { id: string; label: string; detail: string; severity: 'alta'|'media'; href: string };
export type HermesDepartment = {
  id:string;title:string;role:string;specialist:string;href:string;color:string;
  workload:number;mission:string;status:'pendencias'|'acompanhamento'; award:boolean;
};
export type HermesOfficeIntelligence = {
  date: string; health: string; counters: HermesOfficeMetrics;
  risks: HermesOfficeRisk[]; departments: HermesDepartment[];
  meeting: Array<{speaker:string;text:string}>;
  award:{department:string;label:string;basis:string}|null;
  suggestedStrategy:string;
  principles:string[];
};
const positive = (v:unknown) => Math.max(0, Math.min(1000000, Math.floor(Number(v)||0)));
export function normalizeHermesOfficeMetrics(raw:Partial<HermesOfficeMetrics>):HermesOfficeMetrics{
  return {
    total:positive(raw.total),active:positive(raw.active),overdue:positive(raw.overdue),alerts:positive(raw.alerts),
    staleSources:positive(raw.staleSources),readyReviews:positive(raw.readyReviews),
    unavailableReviews:positive(raw.unavailableReviews),criticalReviews:positive(raw.criticalReviews),
    draftMessages:positive(raw.draftMessages),completedActivities30d:positive(raw.completedActivities30d),
    contacts30d:positive(raw.contacts30d),checkedSources30d:positive(raw.checkedSources30d),
  };
}
export function buildHermesOfficeIntelligence(input:Partial<HermesOfficeMetrics>,date:string):HermesOfficeIntelligence{
 const m=normalizeHermesOfficeMetrics(input);
 const risks:HermesOfficeRisk[]=[];
 if(m.overdue)risks.push({id:'overdue',label:'Retornos vencidos',detail:`${m.overdue} processos no cadastro requerem triagem de retorno. Não equivale a prazo judicial.`,severity:'alta',href:'/tarefas'});
 if(m.criticalReviews)risks.push({id:'critical',label:'Revisões prioritárias',detail:`${m.criticalReviews} revisões foram classificadas como críticas pela regra de triagem; conferir as fontes e a urgência.`,severity:'alta',href:'/hermes-3d'});
 if(m.alerts)risks.push({id:'alerts',label:'Alertas no cadastro',detail:`${m.alerts} marcações de novidade requerem conferência; flags sozinhas não confirmam ato judicial.`,severity:'media',href:'/processos'});
 if(m.staleSources||m.unavailableReviews||!m.checkedSources30d)risks.push({
   id:'sources',label:'Cobertura de fontes',
   detail:`${m.staleSources} cadastros sem fonte recente; ${m.unavailableReviews} revisões sem confirmação completa. Não concluir ausência de movimentação.`,
   severity:'media',href:'/integracoes'
 });
 if(!risks.length)risks.push({id:'review',label:'Auditoria de rotina',detail:'Sem sinais operacionais na amostra consolidada. Continuar revisão de fontes e cadastros.',severity:'media',href:'/auditoria'});
 const workload:Record<string,number>={
  processos:m.readyReviews+m.unavailableReviews,provas:m.criticalReviews,
  operacao:m.overdue,comunicacoes:m.draftMessages,relatorios:m.completedActivities30d,
  agentes:m.checkedSources30d,crm:m.contacts30d,gestao:risks.length,
 };
 const roles:Record<string,string>={processos:'Analista judicial',provas:'Revisor de provas',
  operacao:'Coordenador de retornos',comunicacoes:'Redator de atendimento',
  relatorios:'Analista de produtividade',agentes:'Supervisor de agentes',
  crm:'Especialista de relacionamento',gestao:'Gerência'};
 const missions:Record<string,string>={
  processos:'Conferir DJEN e DataJud',provas:'Sinalizar divergências e prazos',operacao:'Ordenar retornos vencidos',
  comunicacoes:'Preparar rascunhos revisáveis',relatorios:'Consolidar trabalho comprovado',
  agentes:'Auditar fontes e versões',crm:'Conferir contatos registrados',gestao:'Reunir achados e supervisionar decisões',
 };
 const candidates=[{id:'processos',score:m.readyReviews,basis:'revisões oficiais prontas'},
  {id:'comunicacoes',score:m.draftMessages,basis:'rascunhos preparados'},
  {id:'crm',score:m.contacts30d,basis:'contatos registrados nos últimos 30 dias'},
  {id:'relatorios',score:m.completedActivities30d,basis:'atividades registradas nos últimos 30 dias'}];
 candidates.sort((a,b)=>b.score-a.score||a.id.localeCompare(b.id));
 const top=candidates[0];
 const award=top?.score>0 ? {department:top.id,label:'Medalha de resultados documentados',basis:`${top.score} ${top.basis}`} : null;
 const departments=getHermesOfficeStations().map(s=>({
  id:s.id,title:s.title,role:roles[s.id]||'Especialista',specialist:s.specialist,
  href:s.href,color:s.color,workload:workload[s.id]||0,mission:missions[s.id]||'Auditar evidências',
  status:(workload[s.id]||0)>0?'pendencias':'acompanhamento' as const,award:award?.department===s.id,
 })) as HermesDepartment[];
 const health=!m.checkedSources30d && !m.readyReviews?'Verificação insuficiente'
  :m.overdue||m.criticalReviews?'Atenção operacional':'Acompanhamento';
 const meeting=[
  {speaker:'Gerência',text:`Pauta: ${m.overdue} retornos vencidos e ${m.criticalReviews} revisões críticas exigem prioridade.`},
  {speaker:'Supervisão',text:`Fontes: ${m.readyReviews} revisões prontas; ${m.unavailableReviews} indisponíveis e ${m.staleSources} cadastros sem fonte recente.`},
  {speaker:'Relacionamento',text:`${m.draftMessages} mensagens em rascunho; ${m.contacts30d} contatos registrados em 30 dias. Envio apenas após revisão.`},
  {speaker:'Produtividade',text:`${m.completedActivities30d} atividades registradas em 30 dias. Não representa número equivalente de pessoas nem desempenho individual.`},
 ];
 return {
  date,health,counters:m,risks,departments,meeting,award,
  suggestedStrategy:top?.score>0 ? `Avaliar versão revisada do fluxo ${top.id}, com comparação de evidências e aprovação antes de substituir a anterior.` : 'Priorizar revisão de fontes e treinamento antes de promover versões de estratégias.',
  principles:['Indicadores operacionais, não probabilidade de ganhar ou perder processo.',
  'Robôs exibem setores e atividades registradas; o movimento visual não comprova trabalho em execução.',
  'Nenhuma resposta enviada, data alterada, fonte removida ou modelo clonado sem validação.',
  'Medalhas são simbólicas e baseadas em registros, não substituição de funcionários.'],
 };
}
export function makeHermesMeetingPrompt(input:Partial<HermesOfficeMetrics>,day:string):string{
 const m=normalizeHermesOfficeMetrics(input);
 return `Dia ${day}. Dados agregados do LexisPredict: ${m.active} casos ativos; ${m.overdue} retornos vencidos; ${m.alerts} flags; ${m.readyReviews} revisões prontas; ${m.unavailableReviews} sem confirmação completa; ${m.criticalReviews} revisões críticas; ${m.staleSources} cadastros com fontes desatualizadas; ${m.checkedSources30d} verificações de fontes em 30 dias; ${m.draftMessages} mensagens rascunhadas; ${m.completedActivities30d} atividades registradas; ${m.contacts30d} contatos registrados. Discuta as fontes, a qualidade e os próximos passos. Sem nomes ou dados pessoais.`;
}
export function sanitizeHermesMeetingOutput(value:unknown):string{
 return String(value||'')
  .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g,' ')
  .split(/\r?\n/).map(line=>line.replace(/[ \t]+/g,' ').trim())
  .filter(Boolean).slice(0,7).join('\n').slice(0,1400);
}
/** Only actual saved speaker turns count as dialogue. A generic summary stays a summary. */
export function parseHermesMeetingTranscript(note:string|null):Array<{speaker:string;text:string}>{
 const clean=sanitizeHermesMeetingOutput(note||'');
 if(!clean)return [];
 const turns=clean.split('\n').map(line=>{
  const m=line.match(/^(Gerência|Supervisão|Processos|Comunicação|Atendimento|Relacionamento|Produtividade|IA)\s*:\s*(.+)$/i);
  return m?{speaker:m[1],text:m[2]}:null;
 }).filter((x):x is {speaker:string;text:string}=>x!==null);
 return turns.length>=2?turns.slice(0,6):[{speaker:'Síntese da IA',text:clean}];
}

/** Saúde operacional individual: verificabilidade e urgência, NÃO prognóstico jurídico. */
export type HermesCaseHealthInput={
 processId:number;client:string;cnj:string;priorityScore:number;priorityLabel:string;
 djenOk:boolean;datajudOk:boolean;checkedAt:string|null;dueOn:string|null;
};
export type HermesCaseHealth=HermesCaseHealthInput & {
 level:'Sem fonte confirmada'|'Revisão urgente'|'Atenção'|'Acompanhamento';
 sourceStatus:string;
};
export function describeHermesCaseHealth(raw:HermesCaseHealthInput):HermesCaseHealth{
 const level:HermesCaseHealth['level']=!raw.djenOk&&!raw.datajudOk
   ?'Sem fonte confirmada'
   :raw.priorityScore>=90?'Revisão urgente':raw.priorityScore>=75?'Atenção':'Acompanhamento';
 const sources:string[]=[];
 if(!raw.djenOk)sources.push('DJEN sem confirmação');
 if(!raw.datajudOk)sources.push('DataJud sem confirmação');
 if(!sources.length)sources.push('DJEN e DataJud com consulta confirmada');
 return {...raw,level,sourceStatus:sources.join(' · ')};
}

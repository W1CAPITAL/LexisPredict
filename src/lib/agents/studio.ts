import {playbooksForRoute} from '@/lib/agent-improvements/route-playbooks';

export type AgentRoleId =
  | 'director'
  | 'researcher'
  | 'legal-researcher'
  | 'builder'
  | 'critic'
  | 'simulator'
  | 'creative'
  | 'qa'
  | 'security'
  | 'operator'
  | 'api-auditor'
  | 'pdf-auditor'
  | 'legal-compliance'
  | 'performance'
  | 'customer-comms';

export type AgentRole = {
  id: AgentRoleId;
  label: string;
  mission: string;
  tools: string[];
};

export type AgentTeamPlan = {
  goal: string;
  roles: AgentRole[];
  gates: string[];
  routeRecommendations?: Array<{ route:string; evidence:string; skill:string }>;
};

const ROLES: Record<AgentRoleId, AgentRole> = {
  director: {
    id: 'director',
    label: 'Director',
    mission: 'Define objetivo, limites e critério de pronto; coordena especialidades.',
    tools: ['memory-core', 'agent-studio'],
  },
  researcher: {
    id: 'researcher',
    label: 'Researcher',
    mission: 'Busca evidência, fontes e lacunas antes de conclusões.',
    tools: ['research-firecrawl', 'memory-core'],
  },
  'legal-researcher': {
    id: 'legal-researcher',
    label: 'Pesquisador legislativo',
    mission: 'Localiza norma e artigo, preserva versão, data e URL oficial, marca lacunas e não presume vigência.',
    tools: ['legislation-reader', 'source-validation'],
  },
  builder: {
    id: 'builder',
    label: 'Builder',
    mission: 'Implementa a menor mudança funcional e reversível.',
    tools: ['developer-lab', 'memory-core'],
  },
  critic: {
    id: 'critic',
    label: 'Critic',
    mission: 'Procura contradições, premissas fracas e terceiro lado.',
    tools: ['memory-core'],
  },
  simulator: {
    id: 'simulator',
    label: 'Simulator',
    mission: 'Modela cenários, agentes e consequências sob premissas explícitas.',
    tools: ['scenario-simulator', 'world-sandbox'],
  },
  creative: {
    id: 'creative',
    label: 'Creative',
    mission: 'Explora alternativas, narrativa, visual e protótipos.',
    tools: ['media-comfy', 'world-sandbox'],
  },
  qa: {
    id: 'qa',
    label: 'QA',
    mission: 'Exige teste, typecheck, build ou evidência funcional antes de conclusão.',
    tools: ['developer-lab'],
  },
  security: {
    id: 'security',
    label: 'Security',
    mission: 'Revê permissões, dados, RLS, abuso e superfície de plugins.',
    tools: ['developer-lab'],
  },
  'api-auditor': {
    id:'api-auditor',
    label:'Auditor de contratos de API',
    mission:'Mapeia método/status/latência somente de tráfego próprio ou autorizado, sem armazenar cookies, chaves ou payloads.',
    tools:['har-observer','api-and-interface-design'],
  },
  'pdf-auditor': {
    id:'pdf-auditor',
    label:'Arquiteto de relatórios e PDF',
    mission:'Valida paridade visual, paginação, conteúdo acessível e exportação confiável.',
    tools:['report-pdf','document-qa'],
  },
  'legal-compliance': {
    id:'legal-compliance',
    label:'Revisor de conformidade',
    mission:'Confere LGPD, escopo da empresa, consentimento e necessidade de revisão humana.',
    tools:['source-validation','security-and-hardening'],
  },
  performance: {
    id:'performance',
    label:'Auditor de performance',
    mission:'Investiga latência, renderizações, uso de RAM e consultas N+1 antes de propor otimização.',
    tools:['metrics','developer-lab'],
  },
  'customer-comms': {
    id:'customer-comms',
    label:'Revisor de atendimento',
    mission:'Prepara mensagens humanas com fatos comprovados, sem afirmar envio e respeitando SAIR.',
    tools:['whatsapp-browser','crm-evidence'],
  },
  operator: {
    id: 'operator',
    label: 'Operator',
    mission: 'Executa fluxos operacionais do Lexis sem ampliar escopo indevidamente.',
    tools: ['memory-core', 'change-watch'],
  },
};

function add(set: Set<AgentRoleId>, ...roles: AgentRoleId[]) {
  for (const role of roles) set.add(role);
}

export function planAgentTeam(goal: string): AgentTeamPlan {
  const text = String(goal || '').trim();
  if (!text) throw new Error('Objetivo vazio.');

  const roles = new Set<AgentRoleId>(['director', 'critic', 'qa']);

  if (/pesquis|fonte|web|jurisprud|precedente/i.test(text)) add(roles, 'researcher');
  if (/\b(lei|artigo|arts?\.|legisla|c[oó]digo civil|cpc\b|cdc\b|lgpd\b|constitui[cç][aã]o|vig[eê]ncia)\b/i.test(text)) add(roles, 'legal-researcher');
  if (/c[oó]digo|app|build|bug|implementar|integra/i.test(text)) add(roles, 'builder', 'security');
  if (/simul|cen[aá]rio|mundo|jogo|agente|economia|estrat[eé]gia/i.test(text)) add(roles, 'simulator');
  if (/imagem|v[ií]deo|visual|criativ|design|narrativa/i.test(text)) add(roles, 'creative');
  if (/processo|carteira|cliente|djen|datajud|tarefa/i.test(text)) add(roles, 'operator');
  if (/\b(api|endpoint|har|contrato de api|reverse[- ]?api|integra[cç][aã]o)\b/i.test(text)) add(roles,'api-auditor','security');
  if (/\b(pdf|impress[aã]o|p[aá]gina[cç][aã]o|exportar relat[oó]rio)\b/i.test(text)) add(roles,'pdf-auditor','qa');
  if (/\b(lgpd|consentimento|compliance|permiss[aã]o|rls|autentica[cç][aã]o)\b/i.test(text)) add(roles,'legal-compliance','security');
  if (/\b(trava|travando|mem[oó]ria|ram|lentid[aã]o|desempenho|performance|lat[eê]ncia)\b/i.test(text)) add(roles,'performance','qa');
  if (/\b(whatsapp|mensagem ao cliente|atendimento ao cliente|opt[- ]?out)\b/i.test(text)) add(roles,'customer-comms','legal-compliance');
  const routePaths=(text.match(/\/[a-z][a-z0-9/-]*/gi)||[]).slice(0,8);
  const routeRecommendations=routePaths.flatMap(route=>playbooksForRoute(route).map(p=>({
    route,evidence:p.evidence,skill:p.skill
  }))).slice(0,12);

  return {
    goal: text.slice(0, 1000),
    roles: [...roles].map((id) => ROLES[id]),
    routeRecommendations,
    gates: [
      'objetivo e critério de pronto definidos',
      'permissões mínimas por ferramenta',
      'evidência/fonte quando necessária',
      'resultado verificado',
      'falha e rollback documentados',
      'enviar mensagens, protocolar e alterar casos exige autorização e evidência confirmada',
      'API: sem replay de sessões, bypass de proteção ou tokens hardcoded',
    ],
  };
}


/** Instrução compacta para uso no fluxo já existente do chat.
 * NÃO executa ferramentas ou modelos adicionais; apenas escolhe critérios.
 */
export function compactAgentGuidance(goal:string):string{
  if(!/\b(api|endpoint|har|pdf|relat[oó]rio|auditoria|dossi[eê]|whatsapp|consentimento|lgpd|ram|desempenho|processo|provas|prazo|integra[cç][aã]o)\b/i.test(goal))return '';
  const plan=planAgentTeam(goal.slice(0,1200));
  const roles=plan.roles.filter(x=>!['director','critic','qa'].includes(x.id)).slice(0,3);
  if(!roles.length)return '';
  return [
    '\n[PLANO DE ESPECIALISTAS - ORIENTAÇÃO, NÃO EXECUÇÃO]',
    ...roles.map(x=>x.label+': '+x.mission.slice(0,145)),
    'Gates: fontes e escopo; se faltar dado, declare lacuna. Não afirme ação de agente, envio ou consulta que não ocorreu.',
    '[/PLANO DE ESPECIALISTAS]',
  ].join('\n').slice(0,720);
}

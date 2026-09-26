export type AgentRoleId =
  | 'director'
  | 'researcher'
  | 'builder'
  | 'critic'
  | 'simulator'
  | 'creative'
  | 'qa'
  | 'security'
  | 'operator';

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
  if (/c[oó]digo|app|build|bug|implementar|integra/i.test(text)) add(roles, 'builder', 'security');
  if (/simul|cen[aá]rio|mundo|jogo|agente|economia|estrat[eé]gia/i.test(text)) add(roles, 'simulator');
  if (/imagem|v[ií]deo|visual|criativ|design|narrativa/i.test(text)) add(roles, 'creative');
  if (/processo|carteira|cliente|djen|datajud|tarefa/i.test(text)) add(roles, 'operator');

  return {
    goal: text.slice(0, 1000),
    roles: [...roles].map((id) => ROLES[id]),
    gates: [
      'objetivo e critério de pronto definidos',
      'permissões mínimas por ferramenta',
      'evidência/fonte quando necessária',
      'resultado verificado',
      'falha e rollback documentados',
    ],
  };
}

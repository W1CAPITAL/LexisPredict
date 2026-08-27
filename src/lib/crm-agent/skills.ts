import type { CrmAgentId } from './types';

export const ALL_SKILLS = `SKILL evidence
- Nunca invente telefone, e-mail, CPF ou valor.
- Fato grava só com evidência observada.

SKILL identity-matching
- Combine por CNJ + nome + telefone; divergência pede humano.

SKILL data-boundaries
- E-mail: rascunho sempre; envio só com confirmação/Resend.
- LinkedIn só se URL colada; CNPJ via BrasilAPI.

SKILL writing-a-brief
- Situação → risco → próxima ação → o que não fazer sozinho.

SKILL email-cliente
- Português, 2ª pessoa, curto. Não invente prazo.

SKILL enriquecer-contato
- CNPJ BrasilAPI; não chute perfil social.`;

export type AgentMeta = {
  nome: string;
  descricao: string;
  faz: string;
  precisa: string;
  tools: string[];
  /** Se true, pode responder só com tools (sem LLM) */
  deterministic?: boolean;
};

export const AGENT_CATALOG: Record<CrmAgentId, AgentMeta> = {
  'silencio-comercial': {
    nome: 'Silêncio comercial',
    descricao: 'Quem sumiu no funil de assessoria há mais de 14 dias.',
    faz: 'Lista negócios sem movimento, ordena por tempo parado e sugere o que falar em cada retorno.',
    precisa: 'Nada obrigatório. Opcional: digite um filtro (nome/escritório).',
    tools: ['list_outstanding_work', 'write_brief'],
    deterministic: true,
  },
  'atraso-regua': {
    nome: 'Régua de atraso',
    descricao: 'Títulos a receber vencidos — ordem de cobrança educada.',
    faz: 'Mostra pendências/atrasos do CRM financeiro e monta sequência de cobrança (D+0, D+3, D+7).',
    precisa: 'Nada. Opcional: nome do cliente no pedido.',
    tools: ['list_outstanding_work', 'draft_email'],
    deterministic: true,
  },
  'brief-negocio': {
    nome: 'Brief de negócio',
    descricao: 'Resumo executivo de um caso/negócio para handoff.',
    faz: 'Lê histórico CRM + processo e devolve brief de 1 tela.',
    precisa: 'CNJ ou nome do cliente no campo Protocolo/Pedido.',
    tools: ['read_crm_history', 'write_brief'],
  },
  'enriquecer-cnj': {
    nome: 'Enriquecer CNJ',
    descricao: 'Contexto processual do número na carteira Lexis.',
    faz: 'Busca o processo no Supabase e resume status, tribunal, retornos.',
    precisa: 'CNJ no campo Protocolo.',
    tools: ['read_crm_history', 'write_brief'],
    deterministic: true,
  },
  'enriquecer-contato': {
    nome: 'Enriquecer contato (CNPJ)',
    descricao: 'Dados públicos de empresa — alternativa a LinkedIn pago.',
    faz: 'Consulta BrasilAPI (razão social, CNAE, situação, cidade/UF).',
    precisa: 'CNPJ no pedido ou no campo dedicado.',
    tools: ['brasilapi_cnpj'],
    deterministic: true,
  },
  'email-cliente': {
    nome: 'E-mail ao cliente',
    descricao: 'Rascunho de e-mail/WhatsApp revisável.',
    faz: 'Gera assunto + corpo; você confirma e envia por mailto ou Resend.',
    precisa: 'E-mail destino + contexto (ou CNJ). Nunca envia sozinho sem você clicar.',
    tools: ['draft_email', 'send_email_optional'],
  },
  'followup-operacional': {
    nome: 'Follow-up operacional',
    descricao: 'Cruza fila jurídica (silêncio/atraso comercial) com prioridade do dia.',
    faz: 'Lista o que está parado e propõe ordem de ligação/WhatsApp.',
    precisa: 'Nada. Roda na carteira da sua empresa.',
    tools: ['list_outstanding_work', 'write_brief'],
    deterministic: true,
  },
  'anotar-carteira': {
    nome: 'Anotar carteira',
    descricao: 'Transforma o que você descreveu em anotação estruturada.',
    faz: 'Propõe texto de nota (quem / o quê / próximo passo) para colar no caso.',
    precisa: 'Descreva o que aconteceu no pedido.',
    tools: ['write_brief'],
  },
  recheck: {
    nome: 'Recheck agendado',
    descricao: 'Agenda revisão daqui a N dias com motivo explícito (CompAI).',
    faz: 'Grava tarefa due na fila crm_agent_tasks.',
    precisa: 'Motivo no pedido. Use o botão Recheck 7d.',
    tools: ['schedule_recheck'],
    deterministic: true,
  },
  livre: {
    nome: 'Agente livre',
    descricao: 'Pergunta aberta com todas as skills.',
    faz: 'Responde com base nas ferramentas + IA (pode demorar mais).',
    precisa: 'Escreva a pergunta com clareza.',
    tools: ['list_outstanding_work', 'write_brief'],
  },
};

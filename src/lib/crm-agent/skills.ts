/**
 * Skills em prosa (estilo CompAI) — o agente lê antes de agir.
 * Nada sobre pessoa é inventado: só evidência observada.
 */
import type { CrmAgentId } from './types';

export const SKILL_EVIDENCE = `SKILL evidence
- Nunca invente telefone, e-mail, CPF, endereço ou status de pagamento.
- Cada fato gravado precisa de evidence_kind (crm.*, processo.*, web.*, operador.*).
- Evidência fraca vira sugestão para o operador — não grava como verdade.`;

export const SKILL_IDENTITY = `SKILL identity-matching
- Combine pessoa por CNJ + nome + telefone; se divergir, peça confirmação humana.
- Não use "confiança %" da IA. Ferramentas reportam o que observaram.`;

export const SKILL_BOUNDARIES = `SKILL data-boundaries
- Não envie e-mail automático sem rascunho revisável pelo operador (salvo RESEND com flag explícita).
- Não invente perfil LinkedIn. Alternativa: URL colada pelo operador ou dados públicos CNPJ (BrasilAPI).
- Escopo: carteira da empresa_id da sessão.`;

export const SKILL_BRIEF = `SKILL writing-a-brief
- Brief curto: situação → risco → próxima ação → o que NÃO fazer sozinho.
- Tom institucional; nunca cite nomes de softwares concorrentes desnecessariamente.`;

export const SKILL_EMAIL = `SKILL email-cliente
- Rascunho em português claro, 2ª pessoa, WhatsApp/e-mail curto.
- Cite só o ato/processo que o operador informou ou que a ferramenta leu.
- Assunto + corpo separados. Sem ameaça indevida.`;

export const SKILL_ENRICH = `SKILL enriquecer-contato
- CNPJ → BrasilAPI (razão social, CNAE, situação). Não é LinkedIn.
- LinkedIn: apenas se o operador colar URL; registre como operador.declaracao.
- RapidAPI não é obrigatório: use DataJud/DJEN/BrasilAPI já no Lexis.`;

export const ALL_SKILLS = [
  SKILL_EVIDENCE,
  SKILL_IDENTITY,
  SKILL_BOUNDARIES,
  SKILL_BRIEF,
  SKILL_EMAIL,
  SKILL_ENRICH,
].join('\n\n');

export const AGENT_CATALOG: Record<
  CrmAgentId,
  { nome: string; descricao: string; tools: string[] }
> = {
  'silencio-comercial': {
    nome: 'Silêncio comercial',
    descricao: 'Negócios sem atualização >14d — prioriza retorno.',
    tools: ['list_outstanding_work', 'read_crm_history', 'write_brief'],
  },
  'atraso-regua': {
    nome: 'Régua de atraso',
    descricao: 'Títulos a receber vencidos — ordem de cobrança educada.',
    tools: ['list_outstanding_work', 'write_brief', 'draft_email'],
  },
  'brief-negocio': {
    nome: 'Brief de negócio',
    descricao: 'Resumo executivo de um negócio/CNJ.',
    tools: ['read_crm_history', 'write_brief'],
  },
  'enriquecer-cnj': {
    nome: 'Enriquecer CNJ',
    descricao: 'Lê processo na carteira e monta contexto processual.',
    tools: ['read_crm_history', 'write_brief'],
  },
  'enriquecer-contato': {
    nome: 'Enriquecer contato',
    descricao: 'CNPJ via BrasilAPI + notas; LinkedIn só com URL informada.',
    tools: ['brasilapi_cnpj', 'record_fact', 'write_brief'],
  },
  'email-cliente': {
    nome: 'E-mail ao cliente',
    descricao: 'Rascunho de e-mail/WhatsApp; envio só com confirmação.',
    tools: ['read_crm_history', 'draft_email', 'send_email_optional'],
  },
  'followup-operacional': {
    nome: 'Follow-up operacional',
    descricao: 'Cruza fila crítica + silêncio comercial (carteira jurídica).',
    tools: ['list_outstanding_work', 'search_processos', 'write_brief'],
  },
  'anotar-carteira': {
    nome: 'Anotar carteira',
    descricao: 'Propõe anotação estruturada para notes/facts.',
    tools: ['read_crm_history', 'record_fact', 'write_brief'],
  },
  recheck: {
    nome: 'Recheck agendado',
    descricao: 'Reagenda revisão com motivo explícito (estilo CompAI).',
    tools: ['schedule_recheck'],
  },
  livre: {
    nome: 'Agente livre',
    descricao: 'Pergunta aberta com todas as skills + tools.',
    tools: ['list_outstanding_work', 'read_crm_history', 'write_brief', 'draft_email'],
  },
};

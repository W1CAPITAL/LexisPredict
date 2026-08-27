/**
 * Camada agentic do CRM Lexis — inspirada no CompAI CRM
 * (skills + tools + fila), adaptada à assessoria financeira.
 * Não usa Eve/Vercel Sandbox: roda em Server Actions + Supabase.
 */

export const CRM_EVIDENCE_KINDS = [
  'crm.thread-reply',
  'crm.pagamento',
  'crm.contrato',
  'processo.cnj',
  'processo.datajud',
  'web.cited-claim',
  'operador.declaracao',
  'sistema.derivado',
] as const;
export type CrmEvidenceKind = (typeof CRM_EVIDENCE_KINDS)[number];

export const CRM_AGENT_IDS = [
  'silencio-comercial',
  'atraso-regua',
  'brief-negocio',
  'enriquecer-cnj',
  'recheck',
  'livre',
] as const;
export type CrmAgentId = (typeof CRM_AGENT_IDS)[number];

export type CrmAgentFact = {
  id?: string;
  empresa_id?: string;
  subject_type: 'negocio' | 'contato' | 'processo' | 'cliente';
  subject_id: string;
  field: string;
  value: string;
  evidence_kind: CrmEvidenceKind;
  evidence_note?: string;
  confidence?: 'primary' | 'supporting' | 'held';
  created_at?: string;
  created_by?: string;
};

export type CrmAgentTask = {
  id: string;
  empresa_id: string;
  agent_id: CrmAgentId;
  status: 'due' | 'leased' | 'done' | 'failed' | 'held';
  subject_type: string;
  subject_id: string;
  payload?: Record<string, unknown>;
  result?: string | null;
  due_at?: string;
  leased_until?: string | null;
  created_at?: string;
};

export type CrmAgentRunLog = {
  agent_id: CrmAgentId;
  tool: string;
  ok: boolean;
  summary: string;
  at: string;
};

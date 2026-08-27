export const CRM_EVIDENCE_KINDS = [
  'crm.thread-reply', 'crm.pagamento', 'crm.contrato', 'crm.email',
  'processo.cnj', 'processo.datajud', 'web.cited-claim', 'web.brasilapi',
  'operador.declaracao', 'sistema.derivado',
] as const;
export type CrmEvidenceKind = (typeof CRM_EVIDENCE_KINDS)[number];

export const CRM_AGENT_IDS = [
  'silencio-comercial', 'atraso-regua', 'brief-negocio', 'enriquecer-cnj',
  'enriquecer-contato', 'email-cliente', 'followup-operacional',
  'anotar-carteira', 'recheck', 'livre',
] as const;
export type CrmAgentId = (typeof CRM_AGENT_IDS)[number];

export type CrmAgentRunLog = {
  agent_id: CrmAgentId;
  tool: string;
  ok: boolean;
  summary: string;
  at: string;
};

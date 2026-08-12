/**
 * CRM Assessoria — tipos de domínio (v2 — pipeline Twenty-like + atividades).
 */

export const CRM_FUNIL_STATUS = [
  'lead',
  'proposta',
  'contrato',
  'execucao',
  'concluido',
  'inadimplente',
  'cancelado',
] as const;

export type CrmFunilStatus = (typeof CRM_FUNIL_STATUS)[number];

export const CRM_FUNIL_LABELS: Record<CrmFunilStatus, string> = {
  lead: 'Lead',
  proposta: 'Proposta',
  contrato: 'Contrato',
  execucao: 'Execução',
  concluido: 'Concluído',
  inadimplente: 'Inadimplente',
  cancelado: 'Cancelado',
};

export const CRM_PAGAMENTO_STATUS = [
  'pendente',
  'pago',
  'atrasado',
  'renegociado',
  'cancelado',
] as const;

export type CrmPagamentoStatus = (typeof CRM_PAGAMENTO_STATUS)[number];

export type CrmServico = {
  id: string;
  empresa_id: string;
  nome: string;
  descricao?: string | null;
  preco_base: number;
  prazo_dias?: number | null;
  ativo: boolean;
  created_at?: string;
};

export type CrmFornecedor = {
  id: string;
  empresa_id: string;
  nome: string;
  cnpj?: string | null;
  contato?: string | null;
  telefone?: string | null;
  email?: string | null;
  especialidade?: string | null;
  ativo: boolean;
  observacao?: string | null;
  created_at?: string;
};

export type CrmNegocio = {
  id: string;
  empresa_id: string;
  created_by?: string | null;
  cliente_nome: string;
  cliente_doc?: string | null;
  cliente_telefone?: string | null;
  cliente_email?: string | null;
  servico_id?: string | null;
  servico_nome?: string | null;
  status: CrmFunilStatus | string;
  /** ordem na coluna do kanban (Twenty: position) */
  position?: number | null;
  valor_total: number;
  valor_entrada?: number | null;
  protocolo_cnj?: string | null;
  fornecedor_id?: string | null;
  custo_terceiro?: number | null;
  origem?: string | null;
  responsavel?: string | null;
  /** owner auth id — Twenty owner */
  owner_id?: string | null;
  observacao?: string | null;
  data_fechamento?: string | null;
  /** próximo follow-up ISO date */
  next_follow_up?: string | null;
  last_activity_at?: string | null;
  created_at?: string;
  updated_at?: string;
};

export type CrmReceber = {
  id: string;
  empresa_id: string;
  negocio_id?: string | null;
  cliente_nome?: string | null;
  descricao?: string | null;
  valor: number;
  vencimento?: string | null;
  status: CrmPagamentoStatus | string;
  pago_em?: string | null;
  forma_pagamento?: string | null;
  observacao?: string | null;
  created_at?: string;
};

export type CrmPagar = {
  id: string;
  empresa_id: string;
  negocio_id?: string | null;
  fornecedor_id?: string | null;
  fornecedor_nome?: string | null;
  descricao: string;
  valor: number;
  vencimento?: string | null;
  status: CrmPagamentoStatus | string;
  pago_em?: string | null;
  /** banca_terceira | operacional | outro */
  categoria?: string | null;
  observacao?: string | null;
  created_at?: string;
};

export type CrmDashboard = {
  receitaMes: number;
  aReceber: number;
  atrasados: number;
  /** alias usado no dashboard legado */
  custoBancasMes?: number;
  /** custo de bancas/terceiros no mês (crm-actions) */
  custoTerceirosMes?: number;
  negociosAbertos?: number;
  porStatus?: Record<string, number>;
  ticketMedio?: number;
  conversaoPct?: number;
  totalNegocios?: number;
  leads?: number;
  emExecucao?: number;
  concluidos?: number;
};

/** Timeline de atividade (Twenty timeline + Comp AI ledger de fatos observados) */
export type CrmActivityType =
  | 'nota'
  | 'ligacao'
  | 'whatsapp'
  | 'email'
  | 'status_change'
  | 'tarefa'
  | 'sistema';

export type CrmActivity = {
  id: string;
  empresa_id: string;
  negocio_id?: string | null;
  tipo: CrmActivityType | string;
  titulo: string;
  corpo?: string | null;
  created_by?: string | null;
  created_by_nome?: string | null;
  meta?: Record<string, unknown> | null;
  created_at?: string;
};

export type CrmTask = {
  id: string;
  empresa_id: string;
  negocio_id?: string | null;
  titulo: string;
  feito: boolean;
  due_at?: string | null;
  assignee_id?: string | null;
  created_by?: string | null;
  created_at?: string;
};

/** Contato observado (não inventar campos) */
export type CrmContato = {
  id: string;
  empresa_id: string;
  nome: string;
  doc?: string | null;
  telefone?: string | null;
  email?: string | null;
  origem?: string | null;
  negocio_ids?: string[];
  processo_count?: number;
  created_at?: string;
};

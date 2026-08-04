/**
 * Pipeline operacional da Automação Judicial (8 etapas).
 * Espelha o rito de gabinete: captura → triagem → cadastro → … → recomendações.
 */

export type PipelineStepId =
  | 'captura'
  | 'triagem'
  | 'cadastro'
  | 'classificacao'
  | 'demanda'
  | 'analise'
  | 'devolutiva'
  | 'recomendacoes';

export interface PipelineStep {
  id: PipelineStepId;
  num: string;
  title: string;
  description: string;
}

export const AUTOMACAO_PIPELINE: PipelineStep[] = [
  {
    id: 'captura',
    num: '01',
    title: 'Captura',
    description:
      'Iniciais e dados processuais (eproc prioritário em SP; e-SAJ secundário). Consulta embutida no app.',
  },
  {
    id: 'triagem',
    num: '02',
    title: 'Triagem',
    description:
      'Recebimento e categorização com OCR / IA jurídica (classe, assunto, custas, BA, sentença).',
  },
  {
    id: 'cadastro',
    num: '03',
    title: 'Cadastro',
    description:
      'Entrada no ERP Lexis (carteira): protocolo, partes, obrigações e prazos prévios.',
  },
  {
    id: 'classificacao',
    num: '04',
    title: 'Classificação',
    description:
      'Distribuição por serviço/produto e identificação de ofensores (banco, seguradora, etc.).',
  },
  {
    id: 'demanda',
    num: '05',
    title: 'Demanda',
    description:
      'Solicitação de insumos para acordo ou defesa (docs, contratos, boletos, guias).',
  },
  {
    id: 'analise',
    num: '06',
    title: 'Análise',
    description:
      'Documentos, evidências, jurisprudência, riscos e estratégias de resolução.',
  },
  {
    id: 'devolutiva',
    num: '07',
    title: 'Devolutiva',
    description:
      'Rascunhos ao cliente (scripts Lexis + IA opcional) com tom leigo e protetivo.',
  },
  {
    id: 'recomendacoes',
    num: '08',
    title: 'Recomendações',
    description:
      'Orientação de defesa com base na análise legal e nos dados do motor neural.',
  },
];

export function stepIndex(id: PipelineStepId): number {
  return AUTOMACAO_PIPELINE.findIndex((s) => s.id === id);
}

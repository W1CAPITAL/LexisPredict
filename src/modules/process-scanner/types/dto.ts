/**
 * @fileOverview DTOs e Interfaces Standard v5.0
 */

export interface MovimentoNacional {
  codigo: string;
  descricao: string;
  dataHora: string;
}

export interface ProcessoStandard {
  numero: string;
  classe: string;
  assunto: string[];
  orgao: string;
  vara: string;
  grau: string;
  situacao: string;
  movimentos: MovimentoNacional[];
  documentos?: any[];
  ultimaMovimentacao: string;
  ultimaAtualizacao: string;
}

// Interfaces originais MNI para retrocompatibilidade interna
export interface NumeroUnico { numero: string; ano: string; tribunal: string; origem: string; }
export interface Parte { nome: string; tipo: string; }
export interface RequisicaoConsultarProcesso {
  idConsultante: string;
  senhaConsultante: string;
  numeroProcesso: string;
  incluirDocumentos: boolean;
  incluirMovimentos?: boolean;
  incluirCabecalho?: boolean;
  dataReferencia?: string;
}

export interface RespostaConsultarProcesso {
  sucesso: boolean;
  mensagem: string;
  processo?: any;
}

export interface RespostaConsultarAlteracao {
  idUltimaAlteracao: string;
  processosAlterados: string[];
}

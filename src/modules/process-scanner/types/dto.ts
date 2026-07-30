/**
 * @fileOverview DTOs Oficiais CNJ Intercomunicação (MNI)
 * Implementação desacoplada conforme especificação br.jus.cnj.intercomunicacao
 */

export interface NumeroUnico {
  numero: string;
  ano: string;
  tribunal: string;
  origem: string;
}

export interface MovimentoNacional {
  codigo: string;
  descricao: string;
  dataHora: string;
  complemento?: string[];
}

export interface DocumentoProcessual {
  id: string;
  tipo: string;
  descricao: string;
  dataHora: string;
  conteudo?: string; // Base64
}

export interface Parte {
  nome: string;
  tipo: 'ATIVO' | 'PASSIVO' | 'TERCEIRO';
  documentoIdentificador?: string;
  representanteProcessual?: RepresentanteProcessual[];
}

export interface RepresentanteProcessual {
  nome: string;
  inscricaoOAB: string;
  ufOAB: string;
}

export interface Processo {
  numeroUnico: NumeroUnico;
  classeProcessual: string;
  assunto: string[];
  valorCausa?: number;
  segredoJustica: boolean;
  partes: Parte[];
  movimentacoes: MovimentoNacional[];
  documentos: DocumentoProcessual[];
  unidadeJudiciaria: string;
  localidade: string;
}

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
  processo?: Processo;
}

export interface RespostaConsultarAlteracao {
  idUltimaAlteracao: string;
  processosAlterados: string[];
}

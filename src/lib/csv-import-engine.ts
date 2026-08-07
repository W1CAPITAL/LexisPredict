/**
 * @fileOverview Motor Canônico de Ingestão CSV v70.0
 * Centraliza a inteligência de mapeamento de aliases e sanitização de dados externos.
 * @copyright 2026 Davi Alves Figueredo / W1 Capital Assessoria Financeira Ltda.
 */

export const CSV_FIELD_ALIASES: Record<string, string[]> = {
  cliente: ['CLIENTE', 'NOME', 'NOME DO CLIENTE', 'NOME_CLIENTE', 'CUSTOMER', 'TITULAR'],
  protocolo: ['PROTOCOLO', 'PROCESSO', 'NUMERO', 'NÚMERO', 'Nº', 'N°', 'NUMERO DO PROCESSO', 'NÚMERO DO PROCESSO', 'CNJ', 'ID', 'REFERENCIA'],
  advogado: ['ADVOGADO', 'ADVOGADO RESPONSAVEL', 'ADVOGADO RESPONSÁVEL', 'ADVOGADO_RESPONSAVEL', 'RESPONSAVEL', 'PROCURADOR'],
  escritorio: ['ESCRITORIO', 'ESCRITÓRIO', 'ESCRITORIO_RESPONSAVEL', 'UNIDADE', 'OFFICE', 'BANCA', 'FILIAL'],
  situacao: ['SITUACAO', 'SITUAÇÃO', 'STATUS', 'SITUACAO_INTERNA', 'FASE', 'ESTADO'],
  observacao: ['OBSERVACAO', 'OBSERVACOES', 'OBSERVAÇÕES', 'OBS', 'NOTAS', 'CONCLUSOS', 'COMENTARIO', 'HISTORICO'],
  telefone: ['TELEFONE', 'CELULAR', 'FONE', 'WHATSAPP', 'TEL', 'CONTATO'],
  ultimoRetorno: ['ULTIMO_RETORNO', 'ÚLTIMO RETORNO', 'ULTIMO RETORNO', 'RETORNO', 'ULTIMORETORNO', 'DATA RETORNO', 'ULTIMO_CONTATO'],
  proximoPrazo: ['PROXIMO_RETORNO', 'PRÓXIMO RETORNO', 'PROXIMO RETORNO', 'PROXIMO_PRAZO', 'PRÓXIMO PRAZO', 'PROXIMOPRAZO', 'PRAZO', 'PROXIMO', 'VENCIMENTO'],
  assistente: ['ASSISTENTE', 'ATENDENTE', 'OPERADOR', 'RESPONSAVEL INTERNO', 'DONO', 'ASSISTENTE_RESPONSAVEL'],
  produtos: ['PRODUTOS', 'PRODUTO', 'SERVICO'],
  dataMovimentacao: ['DATA_MOVIMENTACAO', 'DATA MOVIMENTACAO', 'DATA MOVIMENTAÇÃO', 'DISTRIB', 'DISTRIB.', 'DATA_DISTRIBUICAO'],
  cpf: ['CPF', 'CPF CLIENTE', 'DOCUMENTO', 'C.P.F.', 'CPF DO CLIENTE'],
  email: ['EMAIL', 'E-MAIL', 'EMAIL CLIENTE', 'E-MAIL DO CLIENTE'],
  parte_passiva: ['PARTE PASSIVA', 'PARTE_PASSIVA', 'REU', 'RÉU', 'REQUERIDO', 'BANCO', 'INSTITUICAO', 'CREDORA'],
  parte_passiva_cnpj: ['CNPJ', 'CNPJ DA PARTE', 'CNPJ REU', 'CNPJ RÉU', 'CNPJ BANCO', 'CNPJ CREDORA'],
  classe_acao: ['CLASSE', 'CLASSE ACAO', 'CLASSE DA ACAO', 'TIPO ACAO', 'ACAO'],
};

export function normalizeHeaderKey(header: string): string {
  return header
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove acentos
    .replace(/[^a-zA-Z0-9\s]/g, '') // Remove caracteres especiais
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
}

/**
 * Mapeia um objeto de linha bruto para as chaves canônicas do sistema.
 */
export function mapCsvRowToCanonical(row: Record<string, any>): Record<string, string> {
  const normalized: Record<string, string> = {};
  Object.keys(row).forEach((k) => {
    normalized[normalizeHeaderKey(k)] = String(row[k] ?? '').trim();
  });

  const get = (field: string): string => {
    const aliases = CSV_FIELD_ALIASES[field] || [];
    // Tentativa 1: Alias exato normalizado
    for (const a of aliases) {
      const key = normalizeHeaderKey(a);
      if (normalized[key] !== undefined && normalized[key] !== '') return normalized[key];
    }
    // Tentativa 2: Alias sem espaços (compacto)
    for (const a of aliases) {
      const compact = normalizeHeaderKey(a).replace(/\s+/g, '');
      for (const nk of Object.keys(normalized)) {
        if (nk.replace(/\s+/g, '') === compact && normalized[nk]) return normalized[nk];
      }
    }
    return '';
  };

  return {
    cliente: get('cliente'),
    protocolo: get('protocolo'),
    advogado: get('advogado'),
    escritorio: get('escritorio'),
    situacao: get('situacao'),
    observacao: get('observacao'),
    telefone: get('telefone'),
    ultimoRetorno: get('ultimoRetorno'),
    proximoPrazo: get('proximoPrazo'),
    assistente: get('assistente'),
    produtos: get('produtos'),
    dataMovimentacao: get('dataMovimentacao'),
    cpf: get('cpf'),
    email: get('email'),
    parte_passiva: get('parte_passiva'),
    parte_passiva_cnpj: get('parte_passiva_cnpj'),
    classe_acao: get('classe_acao'),
  };
}

/**
 * Limpa células de data que contenham erros de planilha ou marcadores de texto.
 */
export function sanitizeDateCell(value: string): string {
  const v = String(value || '').trim();
  if (!v) return '';
  const upper = v.toUpperCase();
  const garbage = [
    '-', '—', '#VALUE!', '#REF!', 'ENCERRADO', 'ARQUIVADO', 'EXTINTO', 
    'N/A', 'NA', 'NULL', '0', '00/00/0000', 'S/N', 'SEM DATA', 'A DEFINIR'
  ];
  
  if (garbage.includes(upper) || upper.includes('#')) {
    return '';
  }
  return v;
}

/**
 * Normaliza o protocolo removendo espaços e caracteres de controle invisíveis.
 */
export function sanitizeProtocolo(value: string): string {
  return String(value || '').trim().replace(/\s+/g, '');
}

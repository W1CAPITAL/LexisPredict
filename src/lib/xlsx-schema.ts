/**
 * Esquema canônico de planilha LexisPredict (CSV / XLSX / Google Sheets export).
 * Validação na ingestão + ordem de colunas na exportação.
 */

export const LEXIS_SHEET_SCHEMA = [
  { key: 'protocolo', labels: ['protocolo', 'protocolo ref', 'protocolo_ref', 'cnj', 'numero', 'número', 'processo'], required: true },
  { key: 'cliente', labels: ['cliente', 'nome', 'parte', 'autor', 'requerente'], required: false },
  { key: 'telefone', labels: ['telefone', 'celular', 'whatsapp', 'fone', 'phone'], required: false },
  { key: 'tribunal', labels: ['tribunal', 'tj', 'comarca'], required: false },
  { key: 'status', labels: ['status', 'status prazo', 'status_prazo', 'situacao', 'situação'], required: false },
  { key: 'escritorio', labels: ['escritorio', 'escritório', 'unidade', 'office'], required: false },
  { key: 'advogado', labels: ['advogado', 'adv', 'responsavel', 'responsável'], required: false },
  { key: 'ultimo_retorno', labels: ['ultimo retorno', 'último retorno', 'ultimo_retorno', 'ultimo atendimento', 'retorno'], required: false },
  { key: 'proximo_prazo', labels: ['proximo prazo', 'próximo prazo', 'proximo_prazo', 'prazo', 'proximo retorno'], required: false },
  { key: 'evento_tipo', labels: ['evento_tipo', 'evento tipo', 'tipo evento', 'merito', 'mérito'], required: false },
  { key: 'evento_resumo', labels: ['evento_resumo', 'evento resumo', 'resumo', 'andamento', 'movimentacao', 'movimentação'], required: false },
  { key: 'observacoes', labels: ['observacoes', 'observações', 'obs', 'notas'], required: false },
] as const;

export type LexisSchemaKey = (typeof LEXIS_SHEET_SCHEMA)[number]['key'];

function normHeader(h: string): string {
  return String(h || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[_]+/g, ' ')
    .replace(/\s+/g, ' ');
}

/** Mapeia cabeçalhos da planilha → chaves canônicas */
export function mapHeadersToSchema(headers: string[]): {
  mapping: Record<string, number>; // key -> col index
  missingRequired: string[];
  recognized: string[];
  unknown: string[];
} {
  const mapping: Record<string, number> = {};
  const recognized: string[] = [];
  const unknown: string[] = [];

  headers.forEach((h, idx) => {
    const n = normHeader(h);
    if (!n) return;
    let hit = false;
    for (const col of LEXIS_SHEET_SCHEMA) {
      if (col.labels.some((l) => normHeader(l) === n || n.includes(normHeader(l)) || normHeader(l).includes(n))) {
        if (mapping[col.key] === undefined) {
          mapping[col.key] = idx;
          recognized.push(h);
          hit = true;
          break;
        }
      }
    }
    if (!hit) unknown.push(h);
  });

  const missingRequired = LEXIS_SHEET_SCHEMA.filter((c) => c.required && mapping[c.key] === undefined).map(
    (c) => c.key
  );

  return { mapping, missingRequired, recognized, unknown };
}

export type SchemaValidationResult = {
  ok: boolean;
  mapping: Record<string, number>;
  missingRequired: string[];
  recognized: string[];
  unknown: string[];
  message: string;
  sampleProtocolos: string[];
};

export function validateSheetMatrix(matrix: string[][]): SchemaValidationResult {
  if (!matrix.length) {
    return {
      ok: false,
      mapping: {},
      missingRequired: ['protocolo'],
      recognized: [],
      unknown: [],
      message: 'Planilha vazia.',
      sampleProtocolos: [],
    };
  }

  const headers = matrix[0].map((h) => String(h || ''));
  const { mapping, missingRequired, recognized, unknown } = mapHeadersToSchema(headers);

  if (missingRequired.length) {
    return {
      ok: false,
      mapping,
      missingRequired,
      recognized,
      unknown,
      message: `Coluna obrigatória ausente: ${missingRequired.join(', ')}. Exporte do Google Sheets/Excel com cabeçalho "Protocolo" ou "CNJ".`,
      sampleProtocolos: [],
    };
  }

  const protoIdx = mapping.protocolo;
  const sampleProtocolos: string[] = [];
  let validRows = 0;
  for (let i = 1; i < matrix.length; i++) {
    const p = String(matrix[i][protoIdx] || '').replace(/\D/g, '');
    if (p.length >= 15) {
      validRows++;
      if (sampleProtocolos.length < 3) sampleProtocolos.push(matrix[i][protoIdx]);
    }
  }

  if (validRows === 0) {
    return {
      ok: false,
      mapping,
      missingRequired: [],
      recognized,
      unknown,
      message: 'Nenhuma linha com protocolo/CNJ válido (mín. 15 dígitos).',
      sampleProtocolos: [],
    };
  }

  return {
    ok: true,
    mapping,
    missingRequired: [],
    recognized,
    unknown,
    message: `OK: ${validRows} linha(s) com protocolo. Cabeçalhos reconhecidos: ${recognized.join(', ') || '—'}.`,
    sampleProtocolos,
  };
}

/** Cabeçalhos oficiais na exportação (ordem fixa) */
export const EXPORT_HEADERS = [
  'Protocolo',
  'Cliente',
  'Telefone',
  'Tribunal',
  'Status',
  'Escritorio',
  'Advogado',
  'Ultimo_Retorno',
  'Proximo_Prazo',
  'Evento_Tipo',
  'Evento_Resumo',
  'DataJud_Ultimo',
  'Novo_Andamento',
  'Encerrado_Tribunal',
  'Busca_Apreensao',
  'Cumprimento',
  'Procedente',
  'Improcedente',
  'DJEN_Resumo',
  'Observacoes',
] as const;

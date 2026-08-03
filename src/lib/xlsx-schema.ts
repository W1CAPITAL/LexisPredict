/**
 * Esquema canônico de planilha LexisPredict (CSV / XLSX).
 * Export operacional — SEM id, created_at, empresa_id, created_by.
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

export function mapHeadersToSchema(headers: string[]) {
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
      message: `Coluna obrigatória ausente: ${missingRequired.join(', ')}.`,
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
    message: `OK: ${validRows} linha(s) com protocolo.`,
    sampleProtocolos,
  };
}

/** Cabeçalhos operacionais (estilo RAW_DATA / AUDITORIA) — sem metadados internos */
export const EXPORT_HEADERS = [
  'Assistente',
  'Escritorio',
  'Advogado',
  'Cliente',
  'Telefone',
  'Protocolo',
  'Distribuicao',
  'Status',
  'Observacoes',
  'Produtos',
  'Data_Movimentacao',
  'Andamento',
  'Retorno',
  'Proximo_Retorno',
  'Tribunal',
  'Evento_Tipo',
  'Novo_Andamento',
  'Encerrado_Tribunal',
  'Busca_Apreensao',
  'Cumprimento',
  'DJEN_Resumo',
  'Situacao_Prazo',
] as const;

/** Códigos TT do CNJ → Tribunal */
export const CNJ_TRIBUNAL_MAP: Record<string, string> = {
  '01': 'TJAC - Acre',
  '02': 'TJAL - Alagoas',
  '03': 'TJAP - Amapá',
  '04': 'TJAM - Amazonas',
  '05': 'TJBA - Bahia',
  '06': 'TJCE - Ceará',
  '07': 'TJDF - Distrito Federal',
  '08': 'TJES - Espírito Santo',
  '09': 'TJGO - Goiás',
  '10': 'TJMA - Maranhão',
  '11': 'TJMT - Mato Grosso',
  '12': 'TJMS - Mato Grosso do Sul',
  '13': 'TJMG - Minas Gerais',
  '14': 'TJPA - Pará',
  '15': 'TJPB - Paraíba',
  '16': 'TJPR - Paraná',
  '17': 'TJPE - Pernambuco',
  '18': 'TJPI - Piauí',
  '19': 'TJRJ - Rio de Janeiro',
  '20': 'TJRN - Rio Grande do Norte',
  '21': 'TJRS - Rio Grande do Sul',
  '22': 'TJRO - Rondônia',
  '23': 'TJRR - Roraima',
  '24': 'TJSC - Santa Catarina',
  '25': 'TJSE - Sergipe',
  '26': 'TJSP - São Paulo',
  '27': 'TJTO - Tocantins',
  '90': 'STM',
  '91': 'CSJT',
  '92': 'CNJ',
  '93': 'CJF',
  '94': 'TST',
  '95': 'TSE',
  '96': 'STJ',
  '97': 'STF',
};

export function tribunalFromProtocolo(protocolo: string, fallback?: string): string {
  if (fallback && String(fallback).trim()) return String(fallback).trim();
  const d = String(protocolo || '').replace(/\D/g, '');
  if (d.length >= 16) {
    const tt = d.slice(13, 15);
    return CNJ_TRIBUNAL_MAP[tt] || `Código TT ${tt}`;
  }
  return '—';
}

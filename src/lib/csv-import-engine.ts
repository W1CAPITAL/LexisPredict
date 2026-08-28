/**
 * Motor de import CSV — paridade offline (diagnóstico M/N, serial Excel, aliases W1).
 * @copyright 2026 Davi Alves Figueredo / W1 Capital
 */

import { parseBrazilianDate } from '@/lib/dates';

export const CSV_FIELD_ALIASES: Record<string, string[]> = {
  protocolo: [
    'protocolo', 'cnj', 'numero do processo', 'n processo', 'processo',
    'numero cnj', 'nº processo', 'nr processo', 'num processo',
  ],
  cliente: [
    'cliente', 'nome do cliente', 'parte', 'autor', 'requerente', 'nome',
  ],
  ultimoRetorno: [
    'retorno', 'ultimo retorno', 'último retorno', 'dt retorno', 'data retorno',
    'ultimo', 'col m', 'ultimo retorno cliente',
  ],
  proximoPrazo: [
    'proximo retorno', 'próximo retorno', 'proximo prazo', 'próximo prazo',
    'prazo', 'prox retorno', 'prox. retorno', 'col n', 'dt prazo',
  ],
  telefone: ['telefone', 'tel', 'celular', 'whatsapp', 'fone'],
  assistente: ['atendente', 'assistente', 'operador', 'responsavel', 'responsável'],
  advogado: ['advogado', 'advogado responsavel', 'advogado responsável', 'oab'],
  escritorio: ['escritorio', 'escritório', 'banca', 'unidade'],
  status: ['status', 'situacao', 'situação', 'fase'],
  observacao: ['observacao', 'observação', 'obs', 'conclusos', 'nota'],
};

export function normalizeHeaderKey(h: string): string {
  return String(h || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[._\-/\s]+/g, ' ')
    .trim();
}

/**
 * Serial Excel → YYYY-MM-DD. Epoch 1899-12-30 (bug leap 1900).
 */
export function excelSerialToISO(value: number | string): string | null {
  const n = typeof value === 'number' ? value : Number(String(value).trim().replace(',', '.'));
  if (!Number.isFinite(n)) return null;
  const serial = Math.floor(n);
  if (serial < 20000 || serial > 80000) return null;
  const utc = Date.UTC(1899, 11, 30) + serial * 86400000;
  const d = new Date(utc);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  if (y < 1950 || y > 2110) return null;
  return `${y}-${m}-${day}`;
}

/**
 * Limpa célula de data: lixo de planilha, serial Excel, DD/MM/AAAA → ISO.
 */
export function sanitizeDateCell(value: string | number | null | undefined): string {
  if (value == null) return '';
  if (typeof value === 'number' && Number.isFinite(value)) {
    return excelSerialToISO(value) || '';
  }
  const v = String(value).trim();
  if (!v) return '';
  const upper = v.toUpperCase();
  const garbage = [
    '-', '—', '#VALUE!', '#REF!', '#N/A', '#NAME?', '#DIV/0!',
    'ENCERRADO', 'ARQUIVADO', 'EXTINTO', 'N/A', 'NA', 'NULL', '0',
    '00/00/0000', 'S/N', 'SEM DATA', 'A DEFINIR', 'S/P', 'SEM PRAZO', 'N/D',
  ];
  if (garbage.includes(upper) || upper.includes('#')) return '';

  const serial = excelSerialToISO(v);
  if (serial) return serial;

  const br = parseBrazilianDate(v);
  if (br) return br;

  if (/^\d{4}-\d{2}-\d{2}/.test(v)) return v.slice(0, 10);
  return '';
}

export function sanitizeProtocolo(value: string): string {
  return String(value || '').trim().replace(/\s+/g, '');
}

export type ImportColumnHit = {
  field: string;
  header: string;
  index: number;
  filled: number;
};

export type ImportDiagnosis = {
  hits: ImportColumnHit[];
  unknownHeaders: string[];
  prazosPreenchidos: number;
  retornosPreenchidos: number;
  protocolosValidos: number;
  /** Ex.: "col RETORNO=12, com prazo=840" */
  summary: string;
};

function findBestColumn(headers: string[], aliases: string[], used: Set<number>): { idx: number; header: string } {
  // 1) match exato
  for (const a of aliases) {
    const na = normalizeHeaderKey(a);
    for (let i = 0; i < headers.length; i++) {
      if (used.has(i)) continue;
      if (normalizeHeaderKey(headers[i]) === na) return { idx: i, header: headers[i] };
    }
  }
  // 2) contains (evita "decorrido prazo do banco" se alias for só "prazo" — preferir exact acima)
  for (const a of aliases) {
    const na = normalizeHeaderKey(a);
    if (na.length < 4) continue;
    for (let i = 0; i < headers.length; i++) {
      if (used.has(i)) continue;
      const nh = normalizeHeaderKey(headers[i]);
      if (nh === na || nh.includes(na) || na.includes(nh)) return { idx: i, header: headers[i] };
    }
  }
  return { idx: -1, header: '' };
}

/**
 * Diagnóstico operacional (paridade offline).
 */
export function diagnoseImport(
  headers: string[],
  rows: Record<string, unknown>[]
): ImportDiagnosis {
  const hits: ImportColumnHit[] = [];
  const used = new Set<number>();
  const fieldOrder = [
    'protocolo',
    'ultimoRetorno',
    'proximoPrazo',
    'cliente',
    'assistente',
    'advogado',
  ] as const;

  for (const field of fieldOrder) {
    const aliases = CSV_FIELD_ALIASES[field] || [];
    const { idx, header } = findBestColumn(headers, aliases, used);
    if (idx < 0) continue;
    used.add(idx);
    let filled = 0;
    for (const row of rows) {
      const keys = Object.keys(row);
      const key =
        keys.find((k) => normalizeHeaderKey(k) === normalizeHeaderKey(header)) || header;
      const raw = row[key];
      const cell =
        field === 'proximoPrazo' || field === 'ultimoRetorno'
          ? sanitizeDateCell(raw as any)
          : String(raw ?? '').trim();
      if (cell) filled++;
    }
    hits.push({ field, header, index: idx, filled });
  }

  const unknownHeaders = headers.filter((_, i) => !used.has(i) && String(headers[i] || '').trim());
  const prazoHit = hits.find((h) => h.field === 'proximoPrazo');
  const retornoHit = hits.find((h) => h.field === 'ultimoRetorno');
  const protoHit = hits.find((h) => h.field === 'protocolo');

  const parts: string[] = [];
  for (const h of hits) {
    const label =
      h.field === 'ultimoRetorno'
        ? 'RETORNO'
        : h.field === 'proximoPrazo'
          ? 'PROXIMO_RETORNO'
          : h.field.toUpperCase();
    parts.push(`col ${label}=${h.index}`);
  }
  if (prazoHit) parts.push(`com prazo=${prazoHit.filled}`);
  if (retornoHit) parts.push(`com retorno=${retornoHit.filled}`);
  if (protoHit) parts.push(`protocolos=${protoHit.filled}`);

  return {
    hits,
    unknownHeaders,
    prazosPreenchidos: prazoHit?.filled ?? 0,
    retornosPreenchidos: retornoHit?.filled ?? 0,
    protocolosValidos: protoHit?.filled ?? 0,
    summary: parts.join(', ') || 'nenhuma coluna W1 reconhecida',
  };
}

function pickFromRow(row: Record<string, unknown>, aliases: string[]): string {
  const entries = Object.entries(row);
  // exact
  for (const a of aliases) {
    const na = normalizeHeaderKey(a);
    for (const [k, v] of entries) {
      if (normalizeHeaderKey(k) === na && v != null && String(v).trim()) return String(v).trim();
    }
  }
  // contains
  for (const a of aliases) {
    const na = normalizeHeaderKey(a);
    if (na.length < 4) continue;
    for (const [k, v] of entries) {
      const nk = normalizeHeaderKey(k);
      if ((nk.includes(na) || na.includes(nk)) && v != null && String(v).trim()) {
        return String(v).trim();
      }
    }
  }
  return '';
}

export type CanonicalImportRow = {
  protocolo: string;
  cliente: string;
  ultimoRetorno: string;
  proximoPrazo: string;
  telefone: string;
  assistente: string;
  advogado: string;
  escritorio: string;
  status: string;
  observacao: string;
};

export function mapCsvRowToCanonical(row: Record<string, unknown>): CanonicalImportRow {
  return {
    protocolo: sanitizeProtocolo(pickFromRow(row, CSV_FIELD_ALIASES.protocolo)),
    cliente: pickFromRow(row, CSV_FIELD_ALIASES.cliente),
    ultimoRetorno: sanitizeDateCell(pickFromRow(row, CSV_FIELD_ALIASES.ultimoRetorno)),
    proximoPrazo: sanitizeDateCell(pickFromRow(row, CSV_FIELD_ALIASES.proximoPrazo)),
    telefone: pickFromRow(row, CSV_FIELD_ALIASES.telefone),
    assistente: pickFromRow(row, CSV_FIELD_ALIASES.assistente),
    advogado: pickFromRow(row, CSV_FIELD_ALIASES.advogado),
    escritorio: pickFromRow(row, CSV_FIELD_ALIASES.escritorio),
    status: pickFromRow(row, CSV_FIELD_ALIASES.status),
    observacao: pickFromRow(row, CSV_FIELD_ALIASES.observacao),
  };
}

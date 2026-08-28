
/**
 * Limpa células de data que contenham erros de planilha ou marcadores de texto.
 * Serial Excel → YYYY-MM-DD.
 * Excel epoch: 1899-12-30 (compensa o bug do leap 1900).
 * Aceita 20000–80000 (~1954–2119) para não tratar índice/ano como data.
 */
export function sanitizeDateCell(value: string): string {
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
 * Limpa células de data que contenham erros de planilha, serial Excel ou marcadores.
 * Retorna ISO (YYYY-MM-DD) quando possível, senão o texto sanitizado.
 */
export function sanitizeDateCell(value: string | number | null | undefined): string {
  if (value == null) return '';
  if (typeof value === 'number' && Number.isFinite(value)) {
    return excelSerialToISO(value) || '';
  }
  const v = String(value || '').trim();
  if (!v) return '';
  const upper = v.toUpperCase();
  const garbage = [
    '-', '—', '#VALUE!', '#REF!', 'ENCERRADO', 'ARQUIVADO', 'EXTINTO', 
    'N/A', 'NA', 'NULL', '0', '00/00/0000', 'S/N', 'SEM DATA', 'A DEFINIR'
    '-', '—', '#VALUE!', '#REF!', '#N/A', '#NAME?', '#DIV/0!',
    'ENCERRADO', 'ARQUIVADO', 'EXTINTO',
    'N/A', 'NA', 'NULL', '0', '00/00/0000', 'S/N', 'SEM DATA', 'A DEFINIR',
  ];
  
  if (garbage.includes(upper) || upper.includes('#')) {
    return '';
  }
  const serial = excelSerialToISO(v);
  if (serial) return serial;
  return v;
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
/**
 * Diagnóstico operacional do mapeamento (paridade com o offline).
 * Operador vê na hora se RETORNO / PRÓXIMO RETORNO / PROTOCOLO bateram.
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
  const displayName: Record<string, string> = {
    protocolo: 'PROTOCOLO',
    ultimoRetorno: 'RETORNO',
    proximoPrazo: 'PROXIMO_RETORNO',
    cliente: 'CLIENTE',
    assistente: 'ASSISTENTE',
    advogado: 'ADVOGADO',
  };
  for (const field of fieldOrder) {
    const aliases = CSV_FIELD_ALIASES[field] || [];
    let bestIdx = -1;
    let bestHeader = '';
    headers.forEach((h, idx) => {
      if (used.has(idx)) return;
      const nh = normalizeHeaderKey(h);
      const compact = nh.replace(/\s+/g, '');
      for (const a of aliases) {
        const na = normalizeHeaderKey(a);
        if (nh === na || compact === na.replace(/\s+/g, '')) {
          bestIdx = idx;
          bestHeader = h;
          break;
        }
      }
    });
    if (bestIdx >= 0) {
      used.add(bestIdx);
      const headerKey = headers[bestIdx];
      let filled = 0;
      for (const row of rows) {
        const raw = row[headerKey] ?? row[Object.keys(row).find((k) => normalizeHeaderKey(k) === normalizeHeaderKey(headerKey)) || ''];
        const cell = field === 'proximoPrazo' || field === 'ultimoRetorno'
          ? sanitizeDateCell(raw as any)
          : String(raw ?? '').trim();
        if (cell) filled++;
      }
      hits.push({ field, header: bestHeader, index: bestIdx, filled });
    }
  }
  const unknownHeaders = headers.filter((_, idx) => !used.has(idx) && String(headers[idx] || '').trim());
  const prazoHit = hits.find((h) => h.field === 'proximoPrazo');
  const retornoHit = hits.find((h) => h.field === 'ultimoRetorno');
  const protoHit = hits.find((h) => h.field === 'protocolo');
  const parts: string[] = [];
  for (const h of hits) {
    parts.push(`col ${displayName[h.field] || h.field}=${h.index}`);
  }
  if (prazoHit) parts.push(`com prazo=${prazoHit.filled}`);
  if (retornoHit && !prazoHit) parts.push(`com retorno=${retornoHit.filled}`);
  return {
    hits,
    unknownHeaders,
    prazosPreenchidos: prazoHit?.filled ?? 0,
    retornosPreenchidos: retornoHit?.filled ?? 0,
    protocolosValidos: protoHit?.filled ?? 0,
    summary: parts.join(', ') || 'nenhuma coluna W1 reconhecida',
  };
}
/**
 * Normaliza o protocolo removendo espaços e caracteres de controle invisíveis.
 */
export function sanitizeProtocolo(value: string): string {
  return String(value || '').trim().replace(/\s+/g, '');
}

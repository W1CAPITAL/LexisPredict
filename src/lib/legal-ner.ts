/**
 * NER jurídico determinístico (TypeScript) — sem GPU / sem LLM.
 * Só extrai o que o texto contém. Telefone exige formato BR real;
 * IDs de autos (Id. 230794615) NÃO são telefone.
 */

export type LegalEntityKind =
  | 'cnj'
  | 'cpf'
  | 'cnpj'
  | 'oab'
  | 'banco'
  | 'telefone'
  | 'email'
  | 'data'
  | 'valor_brl'
  | 'tribunal'
  | 'id_pje'
  | 'contrato';

export type LegalEntity = {
  kind: LegalEntityKind;
  value: string;
  normalized?: string;
  index: number;
};

export type LegalNerResult = {
  entities: LegalEntity[];
  byKind: Partial<Record<LegalEntityKind, string[]>>;
  cnjPrincipal?: string;
  bancos: string[];
  summary: string;
};

const CNJ_RE =
  /\b(\d{7})-?(\d{2})\.?(\d{4})\.?(\d)\.?(\d{2})\.?(\d{4})\b/g;

const CPF_RE = /\b(\d{3}\.?\d{3}\.?\d{3}-?\d{2})\b/g;
const CNPJ_RE = /\b(\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2})\b/g;
const OAB_RE = /\bOAB\s*[/:-]?\s*([A-Z]{2})?\s*(\d{2,7})\b/gi;
const EMAIL_RE = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const DATE_RE = /\b(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})\b/g;
const BRL_RE = /R\$\s*([\d.]+,\d{2})/g;
const TRIBUNAL_RE = /\b(TJ[A-Z]{2}|TRF\d|STJ|STF|TST|TSE)\b/g;

/** IDs de peças/autos: Id. 230794615 | Id 231082951 | lds. 233158327 */
const ID_PJE_RE = /\b(?:I\s*d\.?s?\.?|ld\.?s?\.?)\s*(\d{6,12})\b/gi;

/** Telefone BR estrito: (DDD) + 8/9 dígitos, com ou sem máscara */
const PHONE_STRICT_RE =
  /(?:\+55\s*)?(?:\(?([1-9]{1}\d{1})\)?\s*)?(?:9\s*)?(\d{4,5})[-\s]?(\d{4})\b/g;

const BANK_KEYWORDS = [
  'BANCO DO BRASIL',
  'BANCO BRADESCO',
  'BRADESCO',
  'ITAÚ UNIBANCO',
  'BANCO ITAÚ',
  'BANCO ITAU',
  'ITAÚ',
  'ITAU',
  'SANTANDER',
  'BANCO SANTANDER',
  'CAIXA ECONÔMICA',
  'CAIXA ECONOMICA',
  'NUBANK',
  'BANCO INTER',
  'BTG',
  'SAFRA',
  'BANCO PAN',
  'BANCO PAN S.A',
  'C6 BANK',
  'ORIGINAL',
  'VOTORANTIM',
  'BMG',
  'DAYCOVAL',
  'BANCO DAYCOVAL',
  'SICOOB',
  'SICREDI',
  'BANRISUL',
  'NEON',
  'PICPAY',
  'LOSANGO',
  'OMNI',
  'AYMORÉ',
  'AYMORE',
  'BANCO HONDA',
  'BV FINANCEIRA',
  'BANCO BV',
  'BANCO PAN S.A.',
];

function uniq(arr: string[]): string[] {
  const s = new Set<string>();
  const out: string[] = [];
  for (const x of arr) {
    const k = x.trim();
    if (!k || s.has(k)) continue;
    s.add(k);
    out.push(k);
  }
  return out;
}

function formatCnj(m: RegExpMatchArray): string {
  return `${m[1]}-${m[2]}.${m[3]}.${m[4]}.${m[5]}.${m[6]}`;
}

function onlyDigits(s: string): string {
  return s.replace(/\D/g, '');
}

/** DDD válido (aproximado) */
function isValidDdd(ddd: number): boolean {
  return ddd >= 11 && ddd <= 99 && ddd !== 20 && ddd !== 23 && ddd !== 25 && ddd !== 26 && ddd !== 29;
}

/**
 * Telefone BR real:
 * - 10 dígitos (fix) ou 11 (móvel com 9)
 * - DDD válido
 * - móvel: 3º dígito = 9
 * Rejeita: 6–9 dígitos soltos (IDs de autos), números de contrato sem DDD.
 */
function isLikelyBrPhone(digits: string): boolean {
  if (digits.startsWith('55') && (digits.length === 12 || digits.length === 13)) {
    digits = digits.slice(2);
  }
  if (digits.length === 10) {
    const ddd = parseInt(digits.slice(0, 2), 10);
    return isValidDdd(ddd);
  }
  if (digits.length === 11) {
    const ddd = parseInt(digits.slice(0, 2), 10);
    if (!isValidDdd(ddd)) return false;
    return digits[2] === '9';
  }
  return false;
}

/** Contexto imediatamente antes do match indica ID de peça, não telefone */
function isPjeIdContext(src: string, index: number): boolean {
  const before = src.slice(Math.max(0, index - 12), index).toLowerCase();
  return /(?:\bids?\.?\s*|\blds?\.?\s*)$/i.test(before) || /id\.?\s*$/i.test(before);
}

export function extractLegalEntities(text: string): LegalNerResult {
  const src = String(text || '');
  const entities: LegalEntity[] = [];

  const push = (
    kind: LegalEntityKind,
    value: string,
    index: number,
    normalized?: string
  ) => {
    entities.push({ kind, value: value.trim(), index, normalized });
  };

  let m: RegExpExecArray | null;

  // CNJ
  const cnjRe = new RegExp(CNJ_RE.source, 'g');
  while ((m = cnjRe.exec(src))) {
    push('cnj', formatCnj(m), m.index, formatCnj(m));
  }

  // IDs de autos PJe (ANTES de telefone, para não competir)
  const idRe = new RegExp(ID_PJE_RE.source, 'gi');
  const pjeIdSet = new Set<string>();
  while ((m = idRe.exec(src))) {
    const id = m[1];
    pjeIdSet.add(id);
    push('id_pje', m[0].replace(/\s+/g, ' ').trim(), m.index, id);
  }

  // CPF
  const cpfRe = new RegExp(CPF_RE.source, 'g');
  while ((m = cpfRe.exec(src))) {
    const d = onlyDigits(m[1]);
    if (d.length === 11 && !pjeIdSet.has(d)) push('cpf', m[1], m.index, d);
  }

  // CNPJ
  const cnpjRe = new RegExp(CNPJ_RE.source, 'g');
  while ((m = cnpjRe.exec(src))) {
    const d = onlyDigits(m[1]);
    if (d.length === 14) push('cnpj', m[1], m.index, d);
  }

  // OAB
  const oabRe = new RegExp(OAB_RE.source, 'gi');
  while ((m = oabRe.exec(src))) {
    const uf = (m[1] || '').toUpperCase();
    const num = m[2];
    push('oab', m[0], m.index, uf ? `${uf}${num}` : num);
  }

  // E-mail
  const emailRe = new RegExp(EMAIL_RE.source, 'gi');
  while ((m = emailRe.exec(src))) {
    push('email', m[0], m.index, m[0].toLowerCase());
  }

  // Telefone — estrito
  const phoneRe = new RegExp(PHONE_STRICT_RE.source, 'g');
  while ((m = phoneRe.exec(src))) {
    const raw = m[0];
    const digits = onlyDigits(raw);
    if (pjeIdSet.has(digits)) continue;
    if (isPjeIdContext(src, m.index)) continue;
    if (!isLikelyBrPhone(digits)) continue;
    // evita capturar pedaços de CNJ
    if (digits.length >= 14) continue;
    push('telefone', raw.trim(), m.index, digits);
  }

  // Datas
  const dateRe = new RegExp(DATE_RE.source, 'g');
  while ((m = dateRe.exec(src))) {
    push('data', m[0], m.index);
  }

  // Valores R$
  const brlRe = new RegExp(BRL_RE.source, 'g');
  while ((m = brlRe.exec(src))) {
    push('valor_brl', m[0], m.index, m[1]);
  }

  // Tribunal sigla
  const tribRe = new RegExp(TRIBUNAL_RE.source, 'g');
  while ((m = tribRe.exec(src))) {
    push('tribunal', m[0], m.index, m[0].toUpperCase());
  }

  // Contrato / CCB (heurística)
  const contratoRe =
    /\b(?:C[ée]dula\s+de\s+Cr[eé]dito\s+Banc[aá]rio|contrato)\s*n\.?\s*º?\s*(\d{6,15})\b/gi;
  while ((m = contratoRe.exec(src))) {
    push('contrato', m[0].replace(/\s+/g, ' ').trim(), m.index, m[1]);
  }

  // Bancos (keywords longas primeiro)
  const upper = src.toUpperCase();
  const bancos: string[] = [];
  const sortedBanks = [...BANK_KEYWORDS].sort((a, b) => b.length - a.length);
  const claimed = new Set<number>();
  for (const b of sortedBanks) {
    let from = 0;
    while (true) {
      const idx = upper.indexOf(b, from);
      if (idx < 0) break;
      // evita marcar "PAN" isolado dentro de outra palavra já marcada
      let overlap = false;
      for (let i = idx; i < idx + b.length; i++) {
        if (claimed.has(i)) {
          overlap = true;
          break;
        }
      }
      if (!overlap) {
        bancos.push(b.startsWith('BANCO') ? b : b === 'PAN' ? 'BANCO PAN' : b);
        push('banco', b, idx, b.startsWith('BANCO') ? b : b === 'PAN' ? 'BANCO PAN' : b);
        for (let i = idx; i < idx + b.length; i++) claimed.add(i);
      }
      from = idx + b.length;
    }
  }

  const byKind: Partial<Record<LegalEntityKind, string[]>> = {};
  for (const e of entities) {
    const key = e.normalized || e.value;
    if (!byKind[e.kind]) byKind[e.kind] = [];
    if (!byKind[e.kind]!.includes(key)) byKind[e.kind]!.push(key);
  }

  const cnjPrincipal = byKind.cnj?.[0];
  const summaryParts: string[] = [];
  if (cnjPrincipal) summaryParts.push(`CNJ ${cnjPrincipal}`);
  if (byKind.banco?.length)
    summaryParts.push(`Banco: ${byKind.banco.slice(0, 3).join(', ')}`);
  if (byKind.contrato?.length)
    summaryParts.push(`Contrato×${byKind.contrato.length}`);
  if (byKind.id_pje?.length)
    summaryParts.push(`Id.autos×${byKind.id_pje.length}`);
  if (byKind.cpf?.length) summaryParts.push(`CPF×${byKind.cpf.length}`);
  if (byKind.telefone?.length)
    summaryParts.push(`Tel×${byKind.telefone.length}`);
  if (byKind.valor_brl?.length)
    summaryParts.push(`Valores×${byKind.valor_brl.length}`);

  return {
    entities,
    byKind,
    cnjPrincipal,
    bancos: uniq(bancos),
    summary: summaryParts.join(' · ') || 'Nenhuma entidade jurídica óbvia no texto',
  };
}

export function extractCnjList(text: string): string[] {
  return extractLegalEntities(text).byKind.cnj || [];
}

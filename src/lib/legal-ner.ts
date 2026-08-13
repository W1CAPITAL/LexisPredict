/**
 * NER jurídico determinístico — procurações, decisões, petições.
 * Não inventa: só regex/heurística sobre o texto já limpo pelo OCR.
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
  | 'contrato'
  | 'rg'
  | 'cep'
  | 'nome'
  | 'endereco';

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
const OAB_RE =
  /\bOAB\s*[/:]?\s*(?:([A-Z]{2})\s*[/:]?\s*)?(\d{2,7})(?:\s*\/\s*([A-Z]{2}))?\b/gi;
const EMAIL_RE = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const DATE_RE =
  /\b(\d{1,2})\s*(?:de\s+)?([a-zç]+|\d{1,2})(?:\s+de\s+|\s*[\/\-]\s*)(\d{2,4})\b/gi;
const DATE_NUM_RE = /\b(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})\b/g;
const BRL_RE = /R\$\s*([\d.]+,\d{2})/g;
const TRIBUNAL_RE = /\b(TJ[A-Z]{2}|TRF\d|STJ|STF|TST|TSE)\b/g;
const ID_PJE_RE = /\b(?:I\s*d\.?s?\.?|ld\.?s?\.?)\s*(\d{6,12})\b/gi;
const RG_RE =
  /\bRG\s*(?:sob\s*)?(?:N[ºo°\.]?\s*)?(\d{5,12}(?:-?\d)?)\b/gi;
const CEP_RE = /\bCEP\s*[:\s]*(\d{5}-?\d{3})\b/gi;
const PHONE_STRICT_RE =
  /(?:\+55\s*)?(?:\(?([1-9]\d)\)?\s*)?(?:9\s*)?(\d{4,5})[-\s]?(\d{4})\b/g;

const BANK_KEYWORDS = [
  'BANCO VOTORANTIM',
  'BANCO DO BRASIL',
  'BANCO BRADESCO',
  'BANCO ITAÚ',
  'BANCO ITAU',
  'BANCO SANTANDER',
  'BANCO PAN S.A',
  'BANCO PAN',
  'BANCO INTER',
  'BANCO HONDA',
  'BANCO BV',
  'BANCO DAYCOVAL',
  'CAIXA ECONÔMICA',
  'CAIXA ECONOMICA',
  'ITAÚ UNIBANCO',
  'VOTORANTIM',
  'BRADESCO',
  'SANTANDER',
  'NUBANK',
  'ITAÚ',
  'ITAU',
  'BTG',
  'SAFRA',
  'BMG',
  'DAYCOVAL',
  'SICOOB',
  'SICREDI',
  'BANRISUL',
  'LOSANGO',
  'OMNI',
  'AYMORÉ',
  'AYMORE',
  'BV FINANCEIRA',
  'C6 BANK',
  'PAN',
];

/** Nomes após rótulos de procuração / declaração */
const NOME_LABEL_RE =
  /(?:(?:Eu,|nomeia\s+como\s+seu\s+procurador:|outorgante|PROCURAÇÃO[^\n]{0,40})\s*)([A-ZÁÉÍÓÚÂÊÔÃÕÇ][A-ZÁÉÍÓÚÂÊÔÃÕÇa-záéíóúâêôãõç]+(?:\s+[A-ZÁÉÍÓÚÂÊÔÃÕÇ][A-ZÁÉÍÓÚÂÊÔÃÕÇa-záéíóúâêôãõç]+){1,6})(?=\s*,|\s+brasileiro|\s+brasileira|\s+portador|\s+advogado)/gi;

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

function isValidDdd(ddd: number): boolean {
  return ddd >= 11 && ddd <= 99;
}

function isLikelyBrPhone(digits: string): boolean {
  if (digits.startsWith('55') && (digits.length === 12 || digits.length === 13)) {
    digits = digits.slice(2);
  }
  if (digits.length === 10) {
    return isValidDdd(parseInt(digits.slice(0, 2), 10));
  }
  if (digits.length === 11) {
    const ddd = parseInt(digits.slice(0, 2), 10);
    return isValidDdd(ddd) && digits[2] === '9';
  }
  return false;
}

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

  const cnjRe = new RegExp(CNJ_RE.source, 'g');
  while ((m = cnjRe.exec(src))) {
    push('cnj', formatCnj(m), m.index, formatCnj(m));
  }

  const idRe = new RegExp(ID_PJE_RE.source, 'gi');
  const pjeIdSet = new Set<string>();
  while ((m = idRe.exec(src))) {
    pjeIdSet.add(m[1]);
    push('id_pje', m[0].replace(/\s+/g, ' ').trim(), m.index, m[1]);
  }

  const cpfRe = new RegExp(CPF_RE.source, 'g');
  while ((m = cpfRe.exec(src))) {
    const d = onlyDigits(m[1]);
    if (d.length === 11 && !pjeIdSet.has(d)) push('cpf', m[1], m.index, d);
  }

  const cnpjRe = new RegExp(CNPJ_RE.source, 'g');
  while ((m = cnpjRe.exec(src))) {
    const d = onlyDigits(m[1]);
    if (d.length === 14) push('cnpj', m[1], m.index, d);
  }

  const oabRe = new RegExp(OAB_RE.source, 'gi');
  while ((m = oabRe.exec(src))) {
    const uf = (m[1] || m[3] || '').toUpperCase();
    const num = m[2];
    const label = uf ? `OAB ${num}/${uf}` : `OAB ${num}`;
    push('oab', label, m.index, uf ? `${uf}${num}` : num);
  }

  const emailRe = new RegExp(EMAIL_RE.source, 'gi');
  while ((m = emailRe.exec(src))) {
    push('email', m[0], m.index, m[0].toLowerCase());
  }

  const rgRe = new RegExp(RG_RE.source, 'gi');
  while ((m = rgRe.exec(src))) {
    push('rg', m[0].replace(/\s+/g, ' ').trim(), m.index, onlyDigits(m[1]));
  }

  const cepRe = new RegExp(CEP_RE.source, 'gi');
  while ((m = cepRe.exec(src))) {
    const dig = onlyDigits(m[1]);
    const norm = dig.length === 8 ? `${dig.slice(0, 5)}-${dig.slice(5)}` : m[1];
    push('cep', norm, m.index, dig);
  }

  const phoneRe = new RegExp(PHONE_STRICT_RE.source, 'g');
  while ((m = phoneRe.exec(src))) {
    const raw = m[0];
    const digits = onlyDigits(raw);
    if (pjeIdSet.has(digits)) continue;
    if (isPjeIdContext(src, m.index)) continue;
    if (!isLikelyBrPhone(digits)) continue;
    if (digits.length >= 14) continue;
    push('telefone', raw.trim(), m.index, digits);
  }

  const dateNum = new RegExp(DATE_NUM_RE.source, 'g');
  while ((m = dateNum.exec(src))) {
    push('data', m[0], m.index);
  }

  // "3 de agosto de 2026"
  const datePt = new RegExp(DATE_RE.source, 'gi');
  while ((m = datePt.exec(src))) {
    if (/^\d{1,2}[\/\-]\d/.test(m[0])) continue; // já coberto
    push('data', m[0].replace(/\s+/g, ' ').trim(), m.index);
  }

  const brlRe = new RegExp(BRL_RE.source, 'g');
  while ((m = brlRe.exec(src))) {
    push('valor_brl', m[0], m.index, m[1]);
  }

  const tribRe = new RegExp(TRIBUNAL_RE.source, 'g');
  while ((m = tribRe.exec(src))) {
    push('tribunal', m[0], m.index, m[0].toUpperCase());
  }

  const contratoRe =
    /\b(?:C[ée]dula\s+de\s+Cr[eé]dito\s+Banc[aá]rio|contrato)\s*n\.?\s*º?\s*(\d{6,15})\b/gi;
  while ((m = contratoRe.exec(src))) {
    push('contrato', m[0].replace(/\s+/g, ' ').trim(), m.index, m[1]);
  }

  // Nomes (outorgante / procurador)
  const nomeRe = new RegExp(NOME_LABEL_RE.source, 'gi');
  while ((m = nomeRe.exec(src))) {
    const nome = m[1].replace(/\s+/g, ' ').trim();
    if (nome.length >= 8 && nome.split(' ').length >= 2) {
      push('nome', nome, m.index, nome.toUpperCase());
    }
  }
  // Fallback: linhas em CAPS típicas de assinatura
  const capsNome =
    /\b([A-ZÁÉÍÓÚÂÊÔÃÕÇ]{2,}(?:\s+[A-ZÁÉÍÓÚÂÊÔÃÕÇ]{2,}){2,5})\b/g;
  const stop = new Set([
    'PROCURAÇÃO',
    'PODERES',
    'DECLARAÇÃO',
    'ESTADO',
    'PODER',
    'JUDICIARIO',
    'ATENÇÃO',
    'NOVA SERRANA',
  ]);
  while ((m = capsNome.exec(src))) {
    const n = m[1].trim();
    if (stop.has(n)) continue;
    if (n.split(' ').length < 3) continue;
    if (/BANCO|RUA|SALA|CENTRO|CEP/.test(n)) continue;
    // só se ainda não temos esse nome
    if (!entities.some((e) => e.kind === 'nome' && e.normalized === n)) {
      push('nome', n, m.index, n);
    }
  }

  // Endereço simples
  const endRe =
    /\b(?:Rua|Av\.?|Avenida|Travessa|Alameda)\s+[^\n,]{5,60}(?:,\s*n[ºo°]?\s*\d+[^\n,]{0,40})?/gi;
  while ((m = endRe.exec(src))) {
    push('endereco', m[0].replace(/\s+/g, ' ').trim(), m.index);
  }

  const upper = src.toUpperCase();
  const bancos: string[] = [];
  const sortedBanks = [...BANK_KEYWORDS].sort((a, b) => b.length - a.length);
  const claimed = new Set<number>();
  for (const b of sortedBanks) {
    let from = 0;
    while (true) {
      const idx = upper.indexOf(b, from);
      if (idx < 0) break;
      let overlap = false;
      for (let i = idx; i < idx + b.length; i++) {
        if (claimed.has(i)) {
          overlap = true;
          break;
        }
      }
      if (!overlap) {
        const label =
          b === 'PAN' || b === 'VOTORANTIM'
            ? b === 'PAN'
              ? 'BANCO PAN'
              : 'BANCO VOTORANTIM'
            : b;
        bancos.push(label);
        push('banco', label, idx, label);
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
  const parts: string[] = [];
  if (cnjPrincipal) parts.push(`CNJ ${cnjPrincipal}`);
  if (byKind.nome?.length) parts.push(`Nome: ${byKind.nome.slice(0, 2).join(' · ')}`);
  if (byKind.banco?.length) parts.push(`Banco: ${byKind.banco.slice(0, 2).join(', ')}`);
  if (byKind.oab?.length) parts.push(`OAB: ${byKind.oab[0]}`);
  if (byKind.cpf?.length) parts.push(`CPF×${byKind.cpf.length}`);
  if (byKind.email?.length) parts.push(`E-mail×${byKind.email.length}`);
  if (byKind.rg?.length) parts.push(`RG×${byKind.rg.length}`);

  return {
    entities,
    byKind,
    cnjPrincipal,
    bancos: uniq(bancos),
    summary: parts.join(' · ') || 'Nenhuma entidade jurídica óbvia no texto',
  };
}

export function extractCnjList(text: string): string[] {
  return extractLegalEntities(text).byKind.cnj || [];
}

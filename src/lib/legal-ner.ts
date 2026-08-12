/**
 * NER jurídico determinístico (TypeScript) — sem GPU / sem GLiNER.
 * Extrai entidades observadas no texto (CNJ, CPF, CNPJ, OAB, banco, datas, telefones).
 * Não inventa: só o que o regex/heurística encontra no corpus.
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
  | 'tribunal';

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
const PHONE_RE = /\b(?:\+?55\s?)?(?:\(?\d{2}\)?\s?)?(?:9\s?)?\d{4,5}-?\d{4}\b/g;
const DATE_RE = /\b(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})\b/g;
const BRL_RE = /R\$\s*([\d.]+,\d{2})/g;

const BANK_KEYWORDS = [
  'BANCO DO BRASIL',
  'BANCO BRADESCO',
  'BRADESCO',
  'ITAÚ',
  'ITAU',
  'BANCO ITAÚ',
  'BANCO ITAU',
  'SANTANDER',
  'BANCO SANTANDER',
  'CAIXA ECONÔMICA',
  'CAIXA ECONOMICA',
  'NUBANK',
  'INTER',
  'BANCO INTER',
  'BTG',
  'SAFRA',
  'SAFRAO',
  'PAN',
  'BANCO PAN',
  'C6 BANK',
  'ORIGINAL',
  'VOTORANTIM',
  'BMG',
  'DAYCOVAL',
  'BANCO DAYCOVAL',
  'MERCANTIL',
  'SICOOB',
  'SICREDI',
  'BANRISUL',
  'NEON',
  'PICPAY',
  'PAGSEGURO',
  'WILL BANK',
  'BANCO CSF',
  'MIDWAY',
  'LOSANGO',
  'OMNI',
  'AYMORÉ',
  'AYMORE',
  'HONDA',
  'BANCO HONDA',
  'TOYOTA',
  'BV FINANCEIRA',
  'BANCO BV',
];

const TRIBUNAL_RE = /\b(TJ[A-Z]{2}|TRF\d|STJ|STF|TST|TSE)\b/g;

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

export function extractLegalEntities(text: string): LegalNerResult {
  const src = String(text || '');
  const entities: LegalEntity[] = [];

  const push = (kind: LegalEntityKind, value: string, index: number, normalized?: string) => {
    entities.push({ kind, value: value.trim(), index, normalized });
  };

  let m: RegExpExecArray | null;

  const cnjRe = new RegExp(CNJ_RE.source, 'g');
  while ((m = cnjRe.exec(src))) {
    push('cnj', m[0], m.index, formatCnj(m));
  }

  const cpfRe = new RegExp(CPF_RE.source, 'g');
  while ((m = cpfRe.exec(src))) {
    const d = onlyDigits(m[1]);
    if (d.length === 11) push('cpf', m[1], m.index, d);
  }

  const cnpjRe = new RegExp(CNPJ_RE.source, 'g');
  while ((m = cnpjRe.exec(src))) {
    const d = onlyDigits(m[1]);
    if (d.length === 14) push('cnpj', m[1], m.index, d);
  }

  const oabRe = new RegExp(OAB_RE.source, 'gi');
  while ((m = oabRe.exec(src))) {
    const uf = (m[1] || '').toUpperCase();
    const num = m[2];
    push('oab', m[0], m.index, uf ? `${uf}${num}` : num);
  }

  const emailRe = new RegExp(EMAIL_RE.source, 'gi');
  while ((m = emailRe.exec(src))) {
    push('email', m[0], m.index, m[0].toLowerCase());
  }

  const phoneRe = new RegExp(PHONE_RE.source, 'g');
  while ((m = phoneRe.exec(src))) {
    push('telefone', m[0], m.index, onlyDigits(m[0]));
  }

  const dateRe = new RegExp(DATE_RE.source, 'g');
  while ((m = dateRe.exec(src))) {
    push('data', m[0], m.index);
  }

  const brlRe = new RegExp(BRL_RE.source, 'g');
  while ((m = brlRe.exec(src))) {
    push('valor_brl', m[0], m.index, m[1]);
  }

  const tribRe = new RegExp(TRIBUNAL_RE.source, 'g');
  while ((m = tribRe.exec(src))) {
    push('tribunal', m[0], m.index, m[0].toUpperCase());
  }

  const upper = src.toUpperCase();
  const bancos: string[] = [];
  for (const b of BANK_KEYWORDS) {
    const idx = upper.indexOf(b);
    if (idx >= 0) {
      bancos.push(b);
      push('banco', b, idx, b);
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
  if (byKind.banco?.length) summaryParts.push(`Banco: ${byKind.banco.slice(0, 3).join(', ')}`);
  if (byKind.cpf?.length) summaryParts.push(`CPF×${byKind.cpf.length}`);
  if (byKind.cnpj?.length) summaryParts.push(`CNPJ×${byKind.cnpj.length}`);
  if (byKind.oab?.length) summaryParts.push(`OAB×${byKind.oab.length}`);

  return {
    entities,
    byKind,
    cnjPrincipal,
    bancos: uniq(bancos),
    summary: summaryParts.join(' · ') || 'Nenhuma entidade jurídica óbvia no texto',
  };
}

/** Atalho: só CNJs normalizados */
export function extractCnjList(text: string): string[] {
  return extractLegalEntities(text).byKind.cnj || [];
}

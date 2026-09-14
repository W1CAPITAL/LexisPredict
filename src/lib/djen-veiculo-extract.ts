/**
 * Extrai placa e indícios de RENAVAM do teor DJEN (publicação pública).
 * Não consulta SINESP/DETRAN — só texto já publicado.
 */

/** Mercosul ABC1D23 ou antiga ABC-1234 / ABC1234 */
const RE_PLACA_LABELED =
  /\b(?:placa|ve[ií]culo\s+de\s+placa|autom[oó]vel\s+placa)\s*[:\-]?\s*([A-Z]{3}\-?\d[A-Z0-9]\d{2}|[A-Z]{3}\-?\d{4})\b/gi;
const RE_PLACA_MERC = /\b([A-Z]{3}\d[A-Z]\d{2})\b/g;
const RE_PLACA_OLD = /\b([A-Z]{3}\-?\d{4})\b/g;

const RE_RENAVAM_LABELED =
  /\bRENAVAM\s*[:\-]?\s*(\d{9,11})\b/gi;

const BLACKLIST = new Set([
  "BRASIL",
  "ESTADO",
  "MINAS",
  "GERAIS",
  "SAOPA",
  "TRIBU",
]);

function normalizePlate(raw: string): string {
  return String(raw || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

function looksLikePlate(p: string): boolean {
  if (p.length !== 7) return false;
  if (BLACKLIST.has(p.slice(0, 5))) return false;
  // antiga: 3 letras + 4 dígitos
  if (/^[A-Z]{3}\d{4}$/.test(p)) return true;
  // mercosul: 3 letras + dígito + letra + 2 dígitos
  if (/^[A-Z]{3}\d[A-Z]\d{2}$/.test(p)) return true;
  return false;
}

export function extractPlacaFromDjenText(texto: string | null | undefined): string {
  const t = String(texto || "").toUpperCase();
  if (!t.trim()) return "";

  const candidates: string[] = [];
  let m: RegExpExecArray | null;

  RE_PLACA_LABELED.lastIndex = 0;
  while ((m = RE_PLACA_LABELED.exec(t)) !== null) {
    candidates.push(normalizePlate(m[1]));
  }
  if (/placa/i.test(t)) {
    RE_PLACA_MERC.lastIndex = 0;
    while ((m = RE_PLACA_MERC.exec(t)) !== null) candidates.push(normalizePlate(m[1]));
    RE_PLACA_OLD.lastIndex = 0;
    while ((m = RE_PLACA_OLD.exec(t)) !== null) candidates.push(normalizePlate(m[1]));
  }

  for (const p of candidates) {
    if (looksLikePlate(p)) return formatPlaca(p);
  }
  return "";
}

export function extractRenavamFromDjenText(texto: string | null | undefined): string {
  const t = String(texto || "");
  let m: RegExpExecArray | null;
  RE_RENAVAM_LABELED.lastIndex = 0;
  while ((m = RE_RENAVAM_LABELED.exec(t)) !== null) {
    const d = m[1].replace(/\D/g, "");
    if (d.length >= 9 && d.length <= 11) return d;
  }
  return "";
}

export function formatPlaca(p: string): string {
  const n = normalizePlate(p);
  if (n.length !== 7) return n;
  if (/^[A-Z]{3}\d{4}$/.test(n)) return `${n.slice(0, 3)}-${n.slice(3)}`;
  return n; // mercosul sem hífen
}

export type VeiculoDjen = { placa: string; renavam: string };

export function extractVeiculoFromDjenText(texto: string | null | undefined): VeiculoDjen {
  return {
    placa: extractPlacaFromDjenText(texto),
    renavam: extractRenavamFromDjenText(texto),
  };
}

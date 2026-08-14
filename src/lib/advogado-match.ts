/**
 * Liga processos.advogado (MATHEUS, ERALDO / MATHEUS) a advogados_banca (nome + OAB).
 */
import { normalizeLawyerKey } from '@/lib/predatoria-radar';

export type BancaAdv = {
  id?: string;
  nome?: string;
  oab?: string;
  numero_oab?: string;
  oab_uf?: string;
  oabs?: string;
  [k: string]: any;
};

function norm(s: string) {
  return normalizeLawyerKey(s);
}

export function nameTokens(fullName: string): string[] {
  return norm(fullName)
    .split(' ')
    .filter((t) => t.length >= 4 && !['junior', 'filho', 'neto', 'sobrinho'].includes(t));
}

export function firstStrongToken(fullName: string): string | null {
  const toks = nameTokens(fullName);
  return toks[0] || null;
}

export function extractOabNumbers(text: string): string[] {
  const t = String(text || '');
  const out = new Set<string>();
  for (const m of t.matchAll(/\b(\d{3}\.?\d{3}|\d{4,7})\b/g)) {
    const n = m[1].replace(/\D/g, '');
    if (n.length >= 4 && n.length <= 7) out.add(n);
  }
  for (const m of t.matchAll(/(\d{2,3})\.(\d{3})/g)) {
    out.add((m[1] + m[2]).replace(/\D/g, ''));
  }
  return Array.from(out);
}

export function oabNumbersFromBanca(a: BancaAdv): string[] {
  const blob = [a.oab, a.numero_oab, a.oabs, a.nome].filter(Boolean).join(' ');
  return extractOabNumbers(blob);
}

export function caseMatchesBancaAdv(
  caseAdvogadoField: string,
  banca: BancaAdv,
  caseTextExtra?: string
): boolean {
  const field = norm(caseAdvogadoField || '');
  const full = norm(banca.nome || '');
  if (!full && !oabNumbersFromBanca(banca).length) return false;

  const extra = norm(caseTextExtra || '');
  const hayDigits = `${field} ${extra}`.replace(/\D/g, '');

  for (const n of oabNumbersFromBanca(banca)) {
    if (n && hayDigits.includes(n)) return true;
  }

  if (!field) return false;
  if (full.length >= 8 && (field.includes(full) || full.includes(field))) return true;

  const segments = field.split(/[\/|,;]+/).map((s) => s.trim()).filter(Boolean);
  const first = firstStrongToken(banca.nome || '');
  if (first) {
    for (const seg of segments.length ? segments : [field]) {
      const segToks = seg.split(' ').filter(Boolean);
      if (segToks.includes(first)) return true;
      if (segToks.some((t) => t === first || (t.length >= 4 && (t.startsWith(first) || first.startsWith(t))))) return true;
    }
  }
  return false;
}

export function resolveBancaForCaseField(
  caseAdvogadoField: string,
  bancaList: BancaAdv[],
  caseTextExtra?: string
): BancaAdv[] {
  return (bancaList || []).filter((b) => caseMatchesBancaAdv(caseAdvogadoField, b, caseTextExtra));
}

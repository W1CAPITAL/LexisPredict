import type { DjenComunicacao } from './djen';

export type DjenNoticeEvidence = {
  cnj: string; eventAt: string; text: string; link: string | null;
  checkedAt: string; origin: 'official-djen';
};

/** Persist the actual latest publication, separately from heuristic summaries. */
export function latestDjenNoticeEvidence(cnj: string, items: DjenComunicacao[], now = new Date()): DjenNoticeEvidence | null {
  const digits = cnj.replace(/\D/g, '');
  const candidates = items.filter(item =>
    String(item.numero_processo || '').replace(/\D/g, '') === digits &&
    item.texto?.trim() && Number.isFinite(Date.parse(item.data_disponibilizacao || '')),
  ).sort((a, b) => Date.parse(b.data_disponibilizacao!) - Date.parse(a.data_disponibilizacao!));
  const item = candidates[0];
  if (!item) return null;
  return {cnj: digits, eventAt: item.data_disponibilizacao!, text: item.texto!.slice(0, 30000),
    link: item.link, checkedAt: now.toISOString(), origin: 'official-djen'};
}

export function matchingDjenNoticeEvidence(value: unknown, cnj: string, date: string): DjenNoticeEvidence | null {
  if (!value || typeof value !== 'object') return null;
  const evidence = value as DjenNoticeEvidence;
  if (evidence.origin !== 'official-djen' || evidence.cnj !== cnj.replace(/\D/g, '') ||
      evidence.eventAt?.slice(0, 10) !== date.slice(0, 10) ||
      typeof evidence.text !== 'string' || !evidence.text.trim()) return null;
  return evidence;
}

export function usableMovementDescription(text: string): boolean {
  return !!text.trim() && !/^(?:c[oó]d(?:igo)?\.?\s*:?[\s#]*\d+|movimenta[cç][aã]o(?:\s+n[aã]o\s+identificada)?|publica[cç][aã]o|sem\s+descri[cç][aã]o|definitiv[oa]|provis[oó]ri[oa]|outros?|complemento|(?:com|sem)\s+resolu[cç][aã]o\s+(?:de|do)\s+m[eé]rito)\s*$/i.test(text.trim());
}

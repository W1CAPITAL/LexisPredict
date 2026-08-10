/**
 * Calendário judiciário (base nacional + recesso forense).
 * Complementa prazos-cpc — não substitui calendário oficial de cada TJ.
 * @copyright 2026 W1 / LexisPredict
 */

import {
  isDiaUtil,
  proximoDiaUtil,
  addDiasUteis,
  descreverPrazo,
  type PrazoBadge,
} from './prazos-cpc';

/** Recesso forense típico (20/dez–20/jan) — CPC/práticas forenses */
export function isRecessoForense(date: Date | string): boolean {
  const d = date instanceof Date ? date : new Date(date);
  const m = d.getMonth(); // 0-11
  const day = d.getDate();
  // 20 dez – 31 dez
  if (m === 11 && day >= 20) return true;
  // 1 jan – 20 jan
  if (m === 0 && day <= 20) return true;
  return false;
}

/** Dia útil forense = dia útil civil e fora do recesso (regra prática de agenda) */
export function isDiaUtilForense(date: Date | string): boolean {
  if (!isDiaUtil(date)) return false;
  if (isRecessoForense(date)) return false;
  return true;
}

export function proximoDiaUtilForense(date: Date | string): Date {
  let d =
    date instanceof Date
      ? new Date(date.getFullYear(), date.getMonth(), date.getDate())
      : new Date(date);
  d = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  let guard = 0;
  while (!isDiaUtilForense(d) && guard < 40) {
    d.setDate(d.getDate() + 1);
    guard++;
  }
  return d;
}

export type CalendarioDia = {
  date: Date;
  iso: string;
  diaUtil: boolean;
  diaUtilForense: boolean;
  recesso: boolean;
  label: string;
};

function iso(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Grade de N dias a partir de âncora (agenda corporativa) */
export function gradeCalendario(
  anchor: Date,
  dias = 14
): CalendarioDia[] {
  const start = new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate());
  const out: CalendarioDia[] = [];
  for (let i = 0; i < dias; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    const util = isDiaUtil(d);
    const recesso = isRecessoForense(d);
    const forense = util && !recesso;
    let label = forense ? 'Útil' : recesso ? 'Recesso' : 'Não útil';
    out.push({
      date: d,
      iso: iso(d),
      diaUtil: util,
      diaUtilForense: forense,
      recesso,
      label,
    });
  }
  return out;
}

/**
 * Prazo com aviso de recesso / calendário TJ (complemento ao badge CPC).
 */
export function descreverPrazoForense(
  prazo: string | null | undefined,
  hoje: Date = new Date()
): PrazoBadge & { recessoAviso?: string } {
  const base = descreverPrazo(prazo, hoje);
  if (!prazo) return base;
  try {
    const raw = String(prazo);
    let p: Date;
    if (/^\d{2}\/\d{2}\/\d{4}/.test(raw)) {
      const [dd, mm, yyyy] = raw.slice(0, 10).split('/').map(Number);
      p = new Date(yyyy, mm - 1, dd);
    } else {
      p = new Date(raw);
    }
    if (isRecessoForense(p)) {
      return {
        ...base,
        label: `${base.label} · cai em recesso forense`,
        recessoAviso:
          'Data cai no recesso forense (≈20/dez–20/jan). Confirme a contagem no tribunal e no calendário do TJ.',
      };
    }
    if (!isDiaUtil(p)) {
      const next = proximoDiaUtilForense(p);
      return {
        ...base,
        recessoAviso: `Dia não útil. Próximo dia útil forense de referência: ${iso(next)}.`,
      };
    }
  } catch {
    /* */
  }
  return base;
}

export { isDiaUtil, proximoDiaUtil, addDiasUteis, descreverPrazo };

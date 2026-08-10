/**
 * Calculadora de prazos em dias úteis (CPC art. 219 — base nacional).
 * Lista mínima de feriados; extensível por estado depois.
 * @copyright 2026 W1 / LexisPredict
 */

/** Feriados nacionais fixos (MM-DD) */
const FERIADOS_FIXOS = [
  '01-01', // Confraternização
  '04-21', // Tiradentes
  '05-01', // Trabalho
  '09-07', // Independência
  '10-12', // N. Sra. Aparecida
  '11-02', // Finados
  '11-15', // Proclamação
  '11-20', // Consciência Negra (nacional a partir de 2024)
  '12-25', // Natal
];

/** Feriados móveis aproximados 2025–2027 (pascoa-based simplificado — atualizar anualmente) */
const FERIADOS_MOVEIS: string[] = [
  // 2025
  '2025-03-03', // Carnaval
  '2025-03-04',
  '2025-04-18', // Paixão
  '2025-06-19', // Corpus Christi
  // 2026
  '2026-02-16',
  '2026-02-17',
  '2026-04-03',
  '2026-06-04',
  // 2027
  '2027-02-08',
  '2027-02-09',
  '2027-03-26',
  '2027-05-27',
];

function toDate(d: Date | string): Date {
  if (d instanceof Date) return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const s = String(d).trim();
  // dd/MM/yyyy
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(s)) {
    const [dd, mm, yyyy] = s.split('/').map(Number);
    return new Date(yyyy, mm - 1, dd);
  }
  // ISO
  const x = new Date(s);
  return new Date(x.getFullYear(), x.getMonth(), x.getDate());
}

function isoDay(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function mmdd(d: Date): string {
  return `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function isDiaUtil(date: Date | string): boolean {
  const d = toDate(date);
  const wd = d.getDay();
  if (wd === 0 || wd === 6) return false;
  if (FERIADOS_FIXOS.includes(mmdd(d))) return false;
  if (FERIADOS_MOVEIS.includes(isoDay(d))) return false;
  return true;
}

export function proximoDiaUtil(date: Date | string): Date {
  let d = toDate(date);
  d = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  while (!isDiaUtil(d)) {
    d.setDate(d.getDate() + 1);
  }
  return d;
}

/** Soma N dias úteis a partir de data (não conta o dia inicial se quiser prazo processual clássico — aqui conta a partir do dia seguinte). */
export function addDiasUteis(date: Date | string, n: number): Date {
  let d = toDate(date);
  d.setDate(d.getDate() + 1); // começa no dia seguinte
  let left = Math.abs(n);
  const dir = n >= 0 ? 1 : -1;
  while (left > 0) {
    if (isDiaUtil(d)) left--;
    if (left > 0) d.setDate(d.getDate() + dir);
  }
  // garante util
  if (!isDiaUtil(d)) d = proximoDiaUtil(d);
  return d;
}

export type PrazoBadge = {
  label: string;
  tone: 'ok' | 'hoje' | 'atencao' | 'vencido' | 'vazio';
  diasUteisRestantes: number | null;
};

/**
 * Complementa status Vencido/É Hoje/Atenção — não substitui.
 */
export function descreverPrazo(
  prazo: string | null | undefined,
  hoje: Date = new Date()
): PrazoBadge {
  if (!prazo || !String(prazo).trim()) {
    return { label: 'Sem prazo', tone: 'vazio', diasUteisRestantes: null };
  }
  try {
    const p = toDate(prazo);
    const h = toDate(hoje);
    if (p.getTime() === h.getTime()) {
      return { label: 'É hoje (dia útil de referência)', tone: 'hoje', diasUteisRestantes: 0 };
    }
    if (p < h) {
      let d = new Date(p);
      let count = 0;
      while (d < h) {
        d.setDate(d.getDate() + 1);
        if (isDiaUtil(d) && d <= h) count++;
      }
      return {
        label: count <= 1 ? 'Vencido' : `Vencido há ~${count} dia(s) úteis`,
        tone: 'vencido',
        diasUteisRestantes: -count,
      };
    }
    let d = new Date(h);
    let count = 0;
    while (d < p) {
      d.setDate(d.getDate() + 1);
      if (isDiaUtil(d) && d <= p) count++;
    }
    if (count <= 1) return { label: 'Vence em 1 dia útil', tone: 'atencao', diasUteisRestantes: count };
    if (count <= 5) return { label: `Vence em ${count} dias úteis`, tone: 'atencao', diasUteisRestantes: count };
    return { label: `Vence em ${count} dias úteis`, tone: 'ok', diasUteisRestantes: count };
  } catch {
    return { label: 'Prazo inválido', tone: 'vazio', diasUteisRestantes: null };
  }
}

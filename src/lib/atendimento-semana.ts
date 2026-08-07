/**
 * Último atendimento / retorno dentro da semana corrente (seg–dom local).
 * Usado no Efferd dashboard, Processos, Tarefas, dossiê e relatório.
 */
import {
  startOfWeek,
  endOfWeek,
  isWithinInterval,
  getDay,
  format,
  parseISO,
  parse,
  isValid,
  startOfDay,
} from 'date-fns';
import { ptBR } from 'date-fns/locale';

const DAY_LABELS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'] as const;
/** Ordem operacional seg→dom */
const ORDER_SEG_DOM = [1, 2, 3, 4, 5, 6, 0] as const;

export function parseUltimoAtendimento(raw?: string | null): Date | null {
  if (!raw) return null;
  const s = String(raw).trim();
  if (!s || s === '-' || s === '0' || s.toLowerCase() === 'null') return null;

  // ISO
  try {
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
      const d = parseISO(s.slice(0, 10));
      if (isValid(d)) return startOfDay(d);
    }
  } catch { /* */ }

  // BR dd/MM/yyyy ou dd/MM/yy
  try {
    if (/^\d{1,2}\/\d{1,2}\/\d{4}/.test(s)) {
      const d = parse(s.slice(0, 10), 'dd/MM/yyyy', new Date());
      if (isValid(d)) return startOfDay(d);
    }
    if (/^\d{1,2}\/\d{1,2}\/\d{2}(?!\d)/.test(s)) {
      const d = parse(s.slice(0, 8), 'dd/MM/yy', new Date());
      if (isValid(d)) return startOfDay(d);
    }
  } catch { /* */ }

  // yyyy/MM/dd
  try {
    const d = parse(s.slice(0, 10), 'yyyy/MM/dd', new Date());
    if (isValid(d)) return startOfDay(d);
  } catch { /* */ }

  const t = Date.parse(s);
  if (!Number.isNaN(t)) return startOfDay(new Date(t));
  return null;
}

export function weekBounds(ref = new Date()) {
  const start = startOfWeek(ref, { weekStartsOn: 1 });
  const end = endOfWeek(ref, { weekStartsOn: 1 });
  return { start: startOfDay(start), end };
}

export function isAtendidoNestaSemana(
  ultimoRetorno?: string | null,
  ref = new Date()
): boolean {
  const d = parseUltimoAtendimento(ultimoRetorno);
  if (!d) return false;
  const { start, end } = weekBounds(ref);
  return isWithinInterval(d, { start, end });
}

export type AtendimentoDia = {
  day: string;
  dayIndex: number;
  atendimentos: number;
  /** Alias p/ gráfico antigo */
  retornos: number;
  scans: number;
};

/** Conta casos cujo último retorno cai em cada dia da semana atual (seg–dom). */
export function buildAtendimentosPorDiaSemana(
  cases: Array<{ ultimoRetorno?: string | null; ultimo_retorno?: string | null }>,
  ref = new Date()
): AtendimentoDia[] {
  const { start, end } = weekBounds(ref);
  const counts = [0, 0, 0, 0, 0, 0, 0]; // sun..sat

  for (const c of cases || []) {
    const raw = c.ultimoRetorno ?? c.ultimo_retorno;
    const d = parseUltimoAtendimento(raw);
    if (!d) continue;
    if (!isWithinInterval(d, { start, end })) continue;
    counts[getDay(d)] += 1;
  }

  return ORDER_SEG_DOM.map((di) => ({
    day: DAY_LABELS[di],
    dayIndex: di,
    atendimentos: counts[di],
    retornos: counts[di],
    scans: counts[di],
  }));
}

export function countAtendidosNestaSemana(
  cases: Array<{ ultimoRetorno?: string | null; ultimo_retorno?: string | null }>,
  ref = new Date()
): number {
  return (cases || []).filter((c) =>
    isAtendidoNestaSemana(c.ultimoRetorno ?? c.ultimo_retorno, ref)
  ).length;
}

export function labelSemanaAtual(ref = new Date()): string {
  const { start, end } = weekBounds(ref);
  return `${format(start, 'dd/MM', { locale: ptBR })} – ${format(end, 'dd/MM/yyyy', { locale: ptBR })}`;
}

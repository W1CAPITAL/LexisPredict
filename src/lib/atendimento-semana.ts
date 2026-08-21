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
  endOfDay,
} from 'date-fns';
import { ptBR } from 'date-fns/locale';

const TZ_BR = 'America/Sao_Paulo';

/** YYYY-MM-DD em Brasília (evita semana errada no Vercel UTC). */
export function hojeBrasilYmd(ref = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ_BR,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(ref);
}

function ymdToLocalDate(ymd: string): Date {
  const [y, m, d] = ymd.split('-').map((n) => parseInt(n, 10));
  return startOfDay(new Date(y, m - 1, d));
}

const DAY_LABELS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'] as const;
/** Ordem operacional seg→dom */
const ORDER_SEG_DOM = [1, 2, 3, 4, 5, 6, 0] as const;

export function parseUltimoAtendimento(raw?: string | null): Date | null {
  if (!raw) return null;
  const s = String(raw).trim();
  if (!s || s === '-' || s === '0' || s.toLowerCase() === 'null') return null;

  // ISO date-only: interpretar como calendário local (NÃO UTC).
  // parseISO('2026-08-13') vira 12/08 à noite em Brasília e quebra "atendido hoje".
  try {
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
      const [y, m, d] = s.slice(0, 10).split('-').map((n) => parseInt(n, 10));
      if (y && m && d) return startOfDay(new Date(y, m - 1, d));
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
  // Semana seg–dom no calendário de Brasília (não no UTC do servidor)
  const hojeYmd = hojeBrasilYmd(ref);
  const hojeLocal = ymdToLocalDate(hojeYmd);
  const start = startOfWeek(hojeLocal, { weekStartsOn: 1 });
  const end = endOfWeek(hojeLocal, { weekStartsOn: 1 });
  return { start: startOfDay(start), end: endOfDay(end) };
}

/** Extrai último retorno de várias formas do objeto caso */
export function pickUltimoRetorno(c: any): string | null {
  if (!c) return null;
  const v =
    c.ultimoRetorno ??
    c.ultimo_retorno ??
    c.ULTIMO_RETORNO ??
    c.ultimoAtendimento ??
    c.ultimo_atendimento ??
    c.dataUltimoRetorno ??
    c.data_ultimo_retorno ??
    null;
  return v != null ? String(v) : null;
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

/** Aceita string OU objeto caso */
export function casoAtendidoNestaSemana(c: any, ref = new Date()): boolean {
  if (c == null) return false;
  if (typeof c === 'string') return isAtendidoNestaSemana(c, ref);
  return isAtendidoNestaSemana(pickUltimoRetorno(c), ref);
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
    const raw = pickUltimoRetorno(c as any);
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
  return (cases || []).filter((c) => {
    const raw = pickUltimoRetorno(c) ?? (c as any).ultimoRetorno ?? (c as any).ultimo_retorno;
    return isAtendidoNestaSemana(raw, ref);
  }).length;
}

export function labelSemanaAtual(ref = new Date()): string {
  const { start, end } = weekBounds(ref);
  return `${format(start, 'dd/MM', { locale: ptBR })} – ${format(end, 'dd/MM/yyyy', { locale: ptBR })}`;
}

export interface AtendimentoPorUsuario {
  userId: string;
  userNome: string;
  dia: number;
  semana: number;
  mes: number;
}

/** Conta atendimentos por usuário — MESMA regra do dashboard (Brasília, semana com fim). */
export function countAtendimentosPorUsuario(
  cases: Array<{ ultimoRetorno?: string | null; ultimo_retorno?: string | null; atendido_por?: string | null; updated_by?: string | null; edited_by?: string | null }>,
  users: Array<{ auth_user_id: string; nome: string }>,
  ref = new Date()
): AtendimentoPorUsuario[] {
  const userMap = new Map<string, string>();
  for (const u of users || []) {
    const nome = String((u as any).nome || (u as any).email || '').trim();
    if (!nome) continue;
    if ((u as any).auth_user_id) userMap.set(String((u as any).auth_user_id).toLowerCase(), nome);
    if ((u as any).id) userMap.set(String((u as any).id).toLowerCase(), nome);
  }
  const { start: weekStart, end: weekEnd } = weekBounds(ref);
  const hojeYmd = hojeBrasilYmd(ref);
  const [yy, mm] = hojeYmd.split('-').map((n) => parseInt(n, 10));
  const monthStart = startOfDay(new Date(yy, mm - 1, 1));
  const monthEnd = endOfDay(new Date(yy, mm, 0)); // último dia do mês

  const userCounts = new Map<string, { dia: number; semana: number; mes: number }>();

  for (const c of cases || []) {
    const raw = pickUltimoRetorno(c);
    if (!raw) continue;
    const d = parseUltimoAtendimento(raw);
    if (!d) continue;

    // Quem atendeu — nunca created_by (dono ≠ quem ligou)
    const userId = String(
      (c as any).atendido_por ??
        (c as any).atendidoPor ??
        (c as any).edited_by ??
        (c as any).updated_by ??
        ''
    ).trim();
    if (!userId) continue;

    const entry = userCounts.get(userId) || { dia: 0, semana: 0, mes: 0 };

    if (isAtendidoHoje(raw, ref)) entry.dia += 1;
    if (isWithinInterval(d, { start: weekStart, end: weekEnd })) entry.semana += 1;
    if (isWithinInterval(d, { start: monthStart, end: monthEnd })) entry.mes += 1;

    userCounts.set(userId, entry);
  }

  // Garante linha zerada para usuários da empresa (ranking estável)
  for (const u of users || []) {
    const id = String((u as any).auth_user_id || (u as any).id || '');
    if (id && !userCounts.has(id)) userCounts.set(id, { dia: 0, semana: 0, mes: 0 });
  }

  const result: AtendimentoPorUsuario[] = [];
  for (const [userId, counts] of userCounts.entries()) {
    const nome =
      userMap.get(userId) ||
      userMap.get(String(userId).toLowerCase()) ||
      userId;
    result.push({
      userId,
      userNome: nome,
      dia: counts.dia,
      semana: counts.semana,
      mes: counts.mes,
    });
  }

  return result.sort((a, b) => b.semana - a.semana || b.dia - a.dia || b.mes - a.mes);
}

export function getTopAtendentes(
  cases: Array<{ ultimoRetorno?: string | null; ultimo_retorno?: string | null; atendido_por?: string | null; updated_by?: string | null; edited_by?: string | null }>,
  users: Array<{ auth_user_id: string; nome: string }>,
  limit = 5,
  ref = new Date()
): AtendimentoPorUsuario[] {
  return countAtendimentosPorUsuario(cases, users, ref).slice(0, limit);
}

/**
 * Contagem alinhada perfil ↔ /processos:
 * - Só atendido_por / edited_by / updated_by (quem trabalhou no caso)
 * - NÃO usa created_by (dono da carteira) — evita creditar o dono quando outro atende
 */

export function isAtendidoHoje(ultimoRetorno?: string | null, ref = new Date()): boolean {
  const d = parseUltimoAtendimento(ultimoRetorno);
  if (!d) return false;
  const ymd = hojeBrasilYmd(ref);
  const [y, m, day] = ymd.split('-').map((n) => parseInt(n, 10));
  const hoje = new Date(y, m - 1, day);
  return d.getTime() === hoje.getTime();
}

export function countAtendidosSemanaDoUsuario(
  cases: any[],
  userId: string | null | undefined,
  ref = new Date()
): number {
  if (!userId) return 0;
  const uid = String(userId);
  return (cases || []).filter((c) => {
    if (!casoAtendidoNestaSemana(c, ref)) return false;
    // Só quem registrou o atendimento (não o dono do processo)
    const por = c.atendido_por ?? c.atendidoPor ?? c.edited_by ?? c.updated_by ?? null;
    return por != null && String(por) === uid;
  }).length;
}

export function countAtendidosHojeDoUsuario(
  cases: any[],
  userId: string | null | undefined,
  ref = new Date()
): number {
  if (!userId) return 0;
  const uid = String(userId);
  return (cases || []).filter((c) => {
    if (!isAtendidoHoje(pickUltimoRetorno(c), ref)) return false;
    const por = c.atendido_por ?? c.atendidoPor ?? c.edited_by ?? c.updated_by ?? null;
    return por != null && String(por) === uid;
  }).length;
}

// ─── Períodos do dossiê / supervisão ─────────────────────────────────────────

export type PeriodoRelatorio = 'esta_semana' | 'semana_passada' | 'mes';

export const PERIODO_OPCOES: { id: PeriodoRelatorio; label: string; hint: string }[] = [
  { id: 'esta_semana', label: 'Esta semana', hint: 'Seg–dom corrente' },
  { id: 'semana_passada', label: 'Semana passada', hint: 'Seg–dom anterior' },
  { id: 'mes', label: 'Mês atual', hint: 'Do dia 1 até hoje' },
];

export function periodBounds(periodo: PeriodoRelatorio, ref = new Date()) {
  const hojeYmd = hojeBrasilYmd(ref);
  const hojeLocal = ymdToLocalDate(hojeYmd);

  if (periodo === 'esta_semana') {
    const start = startOfWeek(hojeLocal, { weekStartsOn: 1 });
    const end = endOfWeek(hojeLocal, { weekStartsOn: 1 });
    return { start: startOfDay(start), end: endOfDay(end) };
  }

  if (periodo === 'semana_passada') {
    const esta = weekBounds(ref);
    const start = new Date(esta.start);
    start.setDate(start.getDate() - 7);
    const end = new Date(esta.end);
    end.setDate(end.getDate() - 7);
    return { start: startOfDay(start), end: endOfDay(end) };
  }

  // mês atual (calendário BR)
  const start = startOfDay(new Date(hojeLocal.getFullYear(), hojeLocal.getMonth(), 1));
  return { start, end: startOfDay(hojeLocal) };
}

export function labelPeriodo(periodo: PeriodoRelatorio, ref = new Date()): string {
  const { start, end } = periodBounds(periodo, ref);
  const a = format(start, 'dd/MM', { locale: ptBR });
  const b = format(end, 'dd/MM', { locale: ptBR });
  if (periodo === 'esta_semana') return `Esta semana (${a}–${b})`;
  if (periodo === 'semana_passada') return `Semana passada (${a}–${b})`;
  return `Mês ${format(start, 'MMM/yyyy', { locale: ptBR })} (${a}–${b})`;
}

export function isAtendidoNoPeriodo(
  ultimoRetorno: string | null | undefined,
  periodo: PeriodoRelatorio,
  ref = new Date()
): boolean {
  const d = parseUltimoAtendimento(ultimoRetorno);
  if (!d) return false;
  const { start, end } = periodBounds(periodo, ref);
  return isWithinInterval(d, { start, end });
}

export function casoAtendidoNoPeriodo(c: any, periodo: PeriodoRelatorio, ref = new Date()): boolean {
  if (c == null) return false;
  if (typeof c === 'string') return isAtendidoNoPeriodo(c, periodo, ref);
  return isAtendidoNoPeriodo(pickUltimoRetorno(c), periodo, ref);
}

export function countAtendidosNoPeriodo(cases: any[], periodo: PeriodoRelatorio, ref = new Date()): number {
  if (!Array.isArray(cases)) return 0;
  return cases.filter((c) => casoAtendidoNoPeriodo(c, periodo, ref)).length;
}

/** Série diária dentro do período (para gráficos do dossiê). */
export function buildAtendimentosPorDiaPeriodo(
  cases: any[],
  periodo: PeriodoRelatorio,
  ref = new Date()
): (AtendimentoDia & { ymd?: string; label?: string })[] {
  const { start, end } = periodBounds(periodo, ref);
  const days: (AtendimentoDia & { ymd?: string; label?: string })[] = [];
  const cursor = new Date(start);
  while (cursor <= end) {
    const dayIndex = getDay(cursor);
    days.push({
      day: DAY_LABELS[dayIndex],
      dayIndex,
      atendimentos: 0,
      retornos: 0,
      scans: 0,
      ymd: format(cursor, 'yyyy-MM-dd'),
      label: format(cursor, 'dd/MM', { locale: ptBR }),
    });
    cursor.setDate(cursor.getDate() + 1);
  }

  for (const c of cases || []) {
    const d = parseUltimoAtendimento(pickUltimoRetorno(c));
    if (!d || !isWithinInterval(d, { start, end })) continue;
    const ymd = format(d, 'yyyy-MM-dd');
    const bucket = days.find((x) => x.ymd === ymd);
    if (bucket) {
      bucket.atendimentos += 1;
      bucket.retornos += 1;
    }
  }
  return days;
}

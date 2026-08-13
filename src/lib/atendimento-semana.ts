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
  return { start: startOfDay(start), end: startOfDay(end) };
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
  return (cases || []).filter((c) => casoAtendidoNestaSemana(c, ref)).length;
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

/** Conta atendimentos por usuário (dia/semana/mês) baseado no ultimoRetorno */
export function countAtendimentosPorUsuario(
  cases: Array<{ ultimoRetorno?: string | null; ultimo_retorno?: string | null; atendido_por?: string | null; updated_by?: string | null; edited_by?: string | null }>,
  users: Array<{ auth_user_id: string; nome: string }>,
  ref = new Date()
): AtendimentoPorUsuario[] {
  const userMap = new Map(users.map(u => [u.auth_user_id, u.nome]));
  const now = ref;
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const startOfWeek = (d: Date) => {
    const day = d.getDay();
    const diff = d.getDay() === 0 ? -6 : 1 - day; // Monday start
    return startOfDay(new Date(d.getTime() + diff * 86400000));
  };
  const startOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1);
  
  const todayStart = startOfDay(now);
  const weekStart = startOfWeek(now);
  const monthStart = startOfMonth(now);
  
  const userCounts = new Map<string, { dia: number; semana: number; mes: number }>();
  
  for (const c of cases || []) {
    const raw = c.ultimoRetorno ?? c.ultimo_retorno ?? null;
    if (!raw) continue;
    const d = parseUltimoAtendimento(raw);
    if (!d) continue;
    
    // Quem atendeu: atendido_por > edited_by > updated_by > created_by (não zerar KPI)
    const userId =
      (c as any).atendido_por ??
      (c as any).edited_by ??
      (c as any).updated_by ??
      (c as any).created_by ??
      null;
    if (!userId) continue;
    
    const userCountsEntry = userCounts.get(userId) || { dia: 0, semana: 0, mes: 0 };
    
    if (startOfDay(d).getTime() === todayStart.getTime()) userCountsEntry.dia += 1;
    if (d >= weekStart) userCountsEntry.semana += 1;
    if (d >= monthStart) userCountsEntry.mes += 1;
    
    userCounts.set(userId, userCountsEntry);
  }
  
  const result: AtendimentoPorUsuario[] = [];
  for (const [userId, counts] of userCounts.entries()) {
    result.push({
      userId,
      userNome: userMap.get(userId) || userId,
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
 * - Preferência: atendido_por === userId
 * - Legado: sem atendido_por e created_by === userId
 * Evita 16 no perfil e 15 no Top por regras diferentes.
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
    const por = c.atendido_por ?? c.atendidoPor ?? null;
    if (por) return String(por) === uid;
    const created = c.created_by ?? null;
    return created != null && String(created) === uid;
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
    const por = c.atendido_por ?? c.atendidoPor ?? null;
    if (por) return String(por) === uid;
    const created = c.created_by ?? null;
    return created != null && String(created) === uid;
  }).length;
}

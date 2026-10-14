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

const INTERNAL_ATTENDANCE_ACTORS = new Set([
  'af1b75ea-cb64-4ebc-b4ad-ce1ce1fc01c5',
  'sistema-interno',
  'scanner',
  'trigger',
  'cron',
  'bot',
]);

export function pickAtendidoPor(c: any): string | null {
  if (!c || typeof c !== 'object') return null;
  const d = c.dados && typeof c.dados === 'object' ? c.dados : {};
  const value =
    c.atendido_por ??
    c.atendidoPor ??
    d.atendido_por ??
    d.atendidoPor ??
    null;
  const actor = value != null ? String(value).trim() : '';
  return actor || null;
}

export function isAtendimentoHumano(c: any): boolean {
  const actor = pickAtendidoPor(c);
  if (!actor) return false;
  const normalized = actor.trim().toLowerCase();
  if (INTERNAL_ATTENDANCE_ACTORS.has(normalized)) return false;
  return !/sistema interno|w1 control|trigger db|^sistema$|^scanner$|^cron$|^bot$/i.test(normalized);
}

/** Data do evento humano; ultimo_retorno continua sendo a data operacional do retorno. */
export function pickDataAtendimento(c: any): string | null {
  if (!c || typeof c !== 'object') return null;
  const d = c.dados && typeof c.dados === 'object' ? c.dados : {};
  const raw =
    c.atendido_em ??
    c.atendido_em_json ??
    c.atendidoEm ??
    d.atendido_em ??
    d.atendidoEm ??
    pickUltimoRetorno(c);
  return raw != null ? String(raw) : null;
}

/** Operational work by a human: a recorded attendance or a manual edit.
 * Such edits count toward weekly employee productivity, but do not change
 * the customer's real last-return date or imply a message was delivered.
 */
export function humanWorkEvents(c:any):Array<{actor:string;date:string;kind:'contact'|'edit'}>{
  if(!c||typeof c!=='object')return [];
  const d=c.dados&&typeof c.dados==='object'?c.dados:{};
  const out:Array<{actor:string;date:string;kind:'contact'|'edit'}>=[];
  const contact=pickAtendidoPor(c);
  const explicitAttendance=c.atendido_em||c.atendido_em_json||c.atendidoEm||d.atendido_em||d.atendidoEm||null;
  const latestReturn=pickUltimoRetorno(c);
  const autoReturn=String(c.last_auto_wa_at_json||d.wa_ultimo_retorno?.data||'').slice(0,10);
  // Linked-device notices can change ultimo_retorno but never credit the
  // previous human operator with a NEW contact.
  const isAutoDay=!!autoReturn&&!!latestReturn&&String(latestReturn).slice(0,10)===autoReturn;
  const at=explicitAttendance||(isAutoDay?null:latestReturn);
  if(contact&&at&&isAtendimentoHumano(c))out.push({actor:contact,date:String(at),kind:'contact'});
  const editor=String(c.edited_by||c.edited_by_json||d.edited_by||c.auditado_por||'').trim();
  const edited=String(c.edited_at||c.edited_at_json||d.edited_at||c.auditado_em||'').trim();
  if(editor&&edited&&!INTERNAL_ATTENDANCE_ACTORS.has(editor.toLowerCase())&&
    !/sistema interno|w1 control|trigger db|^sistema$|^scanner$|^cron$|^bot$/i.test(editor))
      out.push({actor:editor,date:edited,kind:'edit'});
  return out;
}
function latestHumanWork(c:any,predicate:(day:Date)=>boolean):Date|null{
  let latest:Date|null=null;
  for(const event of humanWorkEvents(c)){
    const day=parseUltimoAtendimento(event.date);
    if(day&&predicate(day)&&(!latest||day>latest))latest=day;
  }
  return latest;
}
export function casoAtendidoHoje(c: any, ref = new Date()): boolean {
  return latestHumanWork(c,d=>isAtendidoHoje(format(d,'yyyy-MM-dd'),ref))!==null;
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
  if (c == null || typeof c === 'string') return false;
  const {start,end}=weekBounds(ref);
  return latestHumanWork(c,d=>isWithinInterval(d,{start,end}))!==null;
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
    const d=latestHumanWork(c,day=>isWithinInterval(day,{start,end}));
    if(d)counts[getDay(d)]++;
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

  for(const c of cases||[]){
    // Each process counts once per human actor, regardless of repeated saves.
    const grouped=new Map<string,Date[]>();
    for(const event of humanWorkEvents(c)){
      const day=parseUltimoAtendimento(event.date);
      if(!day)continue;
      grouped.set(event.actor,[...(grouped.get(event.actor)||[]),day]);
    }
    for(const [userId,days] of grouped){
      const entry=userCounts.get(userId)||{dia:0,semana:0,mes:0};
      if(days.some(d=>format(d,'yyyy-MM-dd')===hojeYmd))entry.dia++;
      if(days.some(d=>isWithinInterval(d,{start:weekStart,end:weekEnd})))entry.semana++;
      if(days.some(d=>isWithinInterval(d,{start:monthStart,end:monthEnd})))entry.mes++;
      userCounts.set(userId,entry);
    }
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

export function isAtendidoHoje(ultimoRetorno?: string | null | Record<string, unknown>, ref = new Date()): boolean {
  let raw: string | null | undefined = null;
  if (ultimoRetorno && typeof ultimoRetorno === "object") {
    raw = pickUltimoRetorno(ultimoRetorno);
  } else {
    raw = ultimoRetorno as string | null | undefined;
  }
  const d = parseUltimoAtendimento(raw);
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
    const {start,end}=weekBounds(ref);
    return humanWorkEvents(c).some(e=>{if(e.actor!==uid)return false;
      const d=parseUltimoAtendimento(e.date);return !!d&&isWithinInterval(d,{start,end});});
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
    return humanWorkEvents(c).some(e=>e.actor===uid&&isAtendidoHoje(e.date,ref));
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
  if (c == null || typeof c === 'string') return false;
  const {start,end}=periodBounds(periodo,ref);
  return latestHumanWork(c,d=>isWithinInterval(d,{start,end}))!==null;
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
    const d=latestHumanWork(c,day=>isWithinInterval(day,{start,end}));
    if(!d)continue;
    const bucket=days.find(x=>x.ymd===format(d,'yyyy-MM-dd'));
    if(bucket){bucket.atendimentos++;bucket.retornos++;}
  }
  return days;
}

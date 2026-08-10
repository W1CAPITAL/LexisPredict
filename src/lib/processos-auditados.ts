/**
 * KPI "Processos auditados" — SEPARADO de atendimento.
 *
 * Conta quando o processo foi:
 *  A) Consultado no tribunal (DataJud / DJEN) — datajud_consultado_em / djen_consultado_em
 *  B) Editado no app (salvar processo, CNJ, dados) — auditado_em + auditado_por
 *
 * NÃO usa ultimo_retorno / atendido_por (isso é KPI de atendimento).
 */
import { isWithinInterval, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  parseUltimoAtendimento,
  weekBounds,
  hojeBrasilYmd,
} from '@/lib/atendimento-semana';

function toDay(raw?: string | null) {
  return parseUltimoAtendimento(raw);
}

function ymdLocal(ymd: string) {
  const [y, m, d] = ymd.split('-').map((n) => parseInt(n, 10));
  return new Date(y, m - 1, d);
}

/** Melhor data de auditoria do processo (não é atendimento). */
export function pickDataAuditoria(c: any): string | null {
  if (!c) return null;
  const candidates = [
    c.auditado_em,
    c.auditadoEm,
    c.datajud_consultado_em,
    c.djen_consultado_em,
    // updated_at só se vier de edição humana marcada
    c.auditado_em ? c.updated_at : null,
  ];
  for (const v of candidates) {
    if (v != null && String(v).trim()) return String(v);
  }
  return null;
}

/** Quem auditou/editou no app (não dono da carteira por padrão). */
export function pickAuditadoPor(c: any): string | null {
  if (!c) return null;
  const v =
    c.auditado_por ??
    c.auditadoPor ??
    c.edited_by ??
    c.updated_by ??
    null;
  return v != null && String(v).trim() ? String(v) : null;
}

export function isAuditadoNestaSemana(c: any, ref = new Date()): boolean {
  const d = toDay(pickDataAuditoria(c));
  if (!d) return false;
  const { start, end } = weekBounds(ref);
  return isWithinInterval(d, { start, end });
}

export function isAuditadoHoje(c: any, ref = new Date()): boolean {
  const d = toDay(pickDataAuditoria(c));
  if (!d) return false;
  const hoje = ymdLocal(hojeBrasilYmd(ref));
  return d.getTime() === hoje.getTime();
}

export function countAuditadosNestaSemana(cases: any[], ref = new Date()): number {
  return (cases || []).filter((c) => isAuditadoNestaSemana(c, ref)).length;
}

export function countAuditadosHoje(cases: any[], ref = new Date()): number {
  return (cases || []).filter((c) => isAuditadoHoje(c, ref)).length;
}

/** Só DataJud/DJEN nesta semana (auditoria de tribunal). */
export function countAuditadosTribunalSemana(cases: any[], ref = new Date()): number {
  const { start, end } = weekBounds(ref);
  return (cases || []).filter((c) => {
    const d = toDay(c?.datajud_consultado_em || c?.djen_consultado_em);
    if (!d) return false;
    return isWithinInterval(d, { start, end });
  }).length;
}

/** Só edição manual (auditado_em) nesta semana. */
export function countEditadosAppSemana(cases: any[], ref = new Date()): number {
  const { start, end } = weekBounds(ref);
  return (cases || []).filter((c) => {
    const d = toDay(c?.auditado_em || c?.auditadoEm);
    if (!d) return false;
    return isWithinInterval(d, { start, end });
  }).length;
}

export type AuditorPorUsuario = {
  userId: string;
  userNome: string;
  dia: number;
  semana: number;
};

export function countAuditoriasPorUsuario(
  cases: any[],
  users: Array<{ auth_user_id: string; nome: string }>,
  ref = new Date()
): AuditorPorUsuario[] {
  const userMap = new Map(users.map((u) => [String(u.auth_user_id), u.nome]));
  const { start, end } = weekBounds(ref);
  const map = new Map<string, { dia: number; semana: number }>();

  for (const c of cases || []) {
    // Só edições humanas com auditado_por — tribunal sem usuário não entra no ranking de pessoa
    const uid = pickAuditadoPor(c);
    if (!uid) continue;
    const d = toDay(c?.auditado_em || c?.auditadoEm);
    if (!d) continue;
    const entry = map.get(uid) || { dia: 0, semana: 0 };
    if (isAuditadoHoje({ auditado_em: c.auditado_em || c.auditadoEm }, ref)) entry.dia += 1;
    if (isWithinInterval(d, { start, end })) entry.semana += 1;
    map.set(uid, entry);
  }

  return Array.from(map.entries())
    .map(([userId, counts]) => ({
      userId,
      userNome: userMap.get(userId) || userId,
      dia: counts.dia,
      semana: counts.semana,
    }))
    .sort((a, b) => b.semana - a.semana || b.dia - a.dia);
}

export function labelSemanaAuditoria(ref = new Date()): string {
  const { start, end } = weekBounds(ref);
  return `${format(start, 'dd/MM', { locale: ptBR })} – ${format(end, 'dd/MM/yyyy', { locale: ptBR })}`;
}

/** Patch para gravar em qualquer save de edição no app */
export function patchAuditoriaEdicao(userId?: string | null) {
  const hoje = hojeBrasilYmd();
  return {
    auditado_em: hoje,
    auditado_por: userId || null,
  };
}

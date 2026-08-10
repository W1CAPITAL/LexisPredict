/**
 * KPI "Processos auditados" — SEPARADO de atendimento.
 * Tribunal (DataJud/DJEN) OU edição salva no app nesta semana (Brasília).
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
  const dados = c.dados && typeof c.dados === 'object' ? c.dados : {};
  const candidates = [
    c.auditado_em,
    c.auditadoEm,
    dados.auditado_em,
    c.datajud_consultado_em,
    dados.datajud_consultado_em,
    c.djen_consultado_em,
    dados.djen_consultado_em,
    c.busca_apreensao_consultado_em,
    dados.busca_apreensao_consultado_em,
    c.cumprimento_sentenca_consultado_em,
    // último movimento DataJud só conta se houve consulta registrada OU nome preenchido pelo scanner
    c.datajud_consultado_em ? c.datajud_ultimo_movimento : null,
    dados.datajud_consultado_em ? dados.datajud_ultimo_movimento : null,
  ];
  for (const v of candidates) {
    if (v != null && String(v).trim() && String(v) !== 'null') return String(v);
  }
  return null;
}

export function pickAuditadoPor(c: any): string | null {
  if (!c) return null;
  const dados = c.dados && typeof c.dados === 'object' ? c.dados : {};
  const v =
    c.auditado_por ??
    c.auditadoPor ??
    dados.auditado_por ??
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
  return d.getTime() === ymdLocal(hojeBrasilYmd(ref)).getTime();
}

export function countAuditadosNestaSemana(cases: any[], ref = new Date()): number {
  return (cases || []).filter((c) => isAuditadoNestaSemana(c, ref)).length;
}

export function countAuditadosHoje(cases: any[], ref = new Date()): number {
  return (cases || []).filter((c) => isAuditadoHoje(c, ref)).length;
}

export function countAuditadosTribunalSemana(cases: any[], ref = new Date()): number {
  const { start, end } = weekBounds(ref);
  return (cases || []).filter((c) => {
    const dados = c?.dados && typeof c.dados === 'object' ? c.dados : {};
    const d = toDay(
      c?.datajud_consultado_em ||
        dados.datajud_consultado_em ||
        c?.djen_consultado_em ||
        dados.djen_consultado_em
    );
    if (!d) return false;
    return isWithinInterval(d, { start, end });
  }).length;
}

export function countEditadosAppSemana(cases: any[], ref = new Date()): number {
  const { start, end } = weekBounds(ref);
  return (cases || []).filter((c) => {
    const dados = c?.dados && typeof c.dados === 'object' ? c.dados : {};
    const d = toDay(c?.auditado_em || c?.auditadoEm || dados.auditado_em);
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
    const uid = pickAuditadoPor(c);
    if (!uid) continue;
    const dados = c?.dados && typeof c.dados === 'object' ? c.dados : {};
    const d = toDay(c?.auditado_em || c?.auditadoEm || dados.auditado_em);
    if (!d) continue;
    const entry = map.get(uid) || { dia: 0, semana: 0 };
    if (isAuditadoHoje(c, ref)) entry.dia += 1;
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

export function patchAuditoriaEdicao(userId?: string | null) {
  const hoje = hojeBrasilYmd();
  return {
    auditado_em: hoje,
    auditado_por: userId || null,
  };
}

/**
 * KPIs separados:
 * - Editados no app (auditado_em) = qualquer salvamento/edição no Lexis
 * - Tribunal (DataJud/DJEN) = só consulta CNJ
 * Atendimento continua em ultimo_retorno (atendimento-semana.ts).
 * Se a edição gravar ultimo_retorno, conta nos DOIS: editado + atendido.
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

function pickDados(c: any) {
  return c?.dados && typeof c.dados === 'object' ? c.dados : {};
}

/** Só edição no app */
export function pickDataEdicaoApp(c: any): string | null {
  if (!c) return null;
  const d = pickDados(c);
  for (const v of [c.auditado_em, c.auditadoEm, d.auditado_em, d.auditadoEm]) {
    if (v != null && String(v).trim() && String(v) !== 'null') return String(v);
  }
  return null;
}

/** Só tribunal */
export function pickDataTribunal(c: any): string | null {
  if (!c) return null;
  const d = pickDados(c);
  for (const v of [
    c.datajud_consultado_em,
    d.datajud_consultado_em,
    c.djen_consultado_em,
    d.djen_consultado_em,
  ]) {
    if (v != null && String(v).trim() && String(v) !== 'null') return String(v);
  }
  return null;
}

/** @deprecated use pickDataEdicaoApp — "auditado" = edição app */
export function pickDataAuditoria(c: any): string | null {
  return pickDataEdicaoApp(c);
}

export function pickAuditadoPor(c: any): string | null {
  if (!c) return null;
  const d = pickDados(c);
  const v = c.auditado_por ?? c.auditadoPor ?? d.auditado_por ?? c.edited_by ?? c.updated_by ?? null;
  return v != null && String(v).trim() ? String(v) : null;
}

export function isEditadoAppNestaSemana(c: any, ref = new Date()): boolean {
  const day = toDay(pickDataEdicaoApp(c));
  if (!day) return false;
  const { start, end } = weekBounds(ref);
  return isWithinInterval(day, { start, end });
}

export function isEditadoAppHoje(c: any, ref = new Date()): boolean {
  const day = toDay(pickDataEdicaoApp(c));
  if (!day) return false;
  return day.getTime() === ymdLocal(hojeBrasilYmd(ref)).getTime();
}

export function isTribunalNestaSemana(c: any, ref = new Date()): boolean {
  const day = toDay(pickDataTribunal(c));
  if (!day) return false;
  const { start, end } = weekBounds(ref);
  return isWithinInterval(day, { start, end });
}

/** Alias: auditados semana = editados no app nesta semana */
export function countAuditadosNestaSemana(cases: any[], ref = new Date()): number {
  return countEditadosAppSemana(cases, ref);
}

export function countAuditadosHoje(cases: any[], ref = new Date()): number {
  return countEditadosAppHoje(cases, ref);
}

export function countEditadosAppSemana(cases: any[], ref = new Date()): number {
  return (cases || []).filter((c) => isEditadoAppNestaSemana(c, ref)).length;
}

export function countEditadosAppHoje(cases: any[], ref = new Date()): number {
  return (cases || []).filter((c) => isEditadoAppHoje(c, ref)).length;
}

export function countAuditadosTribunalSemana(cases: any[], ref = new Date()): number {
  return (cases || []).filter((c) => isTribunalNestaSemana(c, ref)).length;
}

export function labelSemanaAuditoria(ref = new Date()): string {
  const { start, end } = weekBounds(ref);
  return `${format(start, 'dd/MM', { locale: ptBR })} – ${format(end, 'dd/MM/yyyy', { locale: ptBR })}`;
}

/** Carimbo em qualquer save (edição, atendimento, encerrar, status…) */
export function patchAuditoriaEdicao(userId?: string | null) {
  return {
    auditado_em: hojeBrasilYmd(),
    auditado_por: userId || null,
  };
}

/**
 * Ao registrar atendimento/encerrar: grava retorno + marca edição.
 * Assim conta em Atendidos (ultimo_retorno) E Editados app (auditado_em).
 */
export function patchAtendimentoComEdicao(
  userId?: string | null,
  ultimoRetorno?: string | null
) {
  const hoje = hojeBrasilYmd();
  return {
    ultimoRetorno: ultimoRetorno || hoje,
    atendido_por: userId || null,
    ...patchAuditoriaEdicao(userId),
  };
}

import type { LegalCase } from './case-logic';
export function isNovidadeAberta(c: Pick<LegalCase, 'tem_atualizacao_pos_retorno' | 'tem_novo_andamento' | 'djen_nova_comunicacao'>): boolean {
  return !!(c.tem_atualizacao_pos_retorno || c.tem_novo_andamento || c.djen_nova_comunicacao);
}
export function resolveTemNovoAndamento(c: any): boolean {
  const flagged = Boolean(c?.tem_atualizacao_pos_retorno || c?.djen_nova_comunicacao || c?.tem_novo_andamento);
  if (!flagged) return false;
  const events = [c.evento_data, c.datajud_ultimo_movimento, c.djen_ultima_data].filter(Boolean).map((s) => Date.parse(String(s))).filter(Number.isFinite);
  if (!events.length) return false;
  const lastEvent = Math.max(...events);
  const ack = Date.parse(c.alert_ack_at || c.atendido_em || '');
  if (Number.isFinite(ack)) return lastEvent > ack;
  const raw = String(c.ultimoRetorno || c.ultimo_retorno || '');
  const date = raw.includes('/') ? raw.split('/').reverse().join('-') : raw.slice(0, 10);
  return !date || new Date(lastEvent).toISOString().slice(0, 10) > date;
}
export function patchClearNovidade(): Record<string, boolean> {
  return { tem_atualizacao_pos_retorno: false, tem_novo_andamento: false, djen_nova_comunicacao: false };
}

/** Mantém flag de alerta: se novo sinal true → true; se false e prev true → true; senão undefined (não grava). */
export function mergeFlagAlerta(
  alerta: boolean,
  prev: boolean | null | undefined
): boolean | undefined {
  if (alerta) return true;
  if (prev === true) return true;
  if (prev === false) return false;
  return undefined;
}

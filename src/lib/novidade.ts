/**
 * Definição ÚNICA de “novidade” no LexisPredict.
 * Dashboard, Tarefas, Dossiê, Notificações e processarCaso devem usar isto.
 * @copyright 2026 Davi Alves Figueredo / W1 Capital Assessoria Financeira Ltda.
 */

import type { LegalCase } from './case-logic';

/** Qualquer sinal de movimentação/publicação ainda não atendido */
export function isNovidadeAberta(c: Pick<LegalCase, 'tem_atualizacao_pos_retorno' | 'tem_novo_andamento' | 'djen_nova_comunicacao'>): boolean {
  return !!(c.tem_atualizacao_pos_retorno || c.tem_novo_andamento || c.djen_nova_comunicacao);
}

/**
 * Alias de leitura: tem_novo_andamento sempre reflete a união das flags persistidas.
 * Canônico no banco: tem_atualizacao_pos_retorno + djen_nova_comunicacao.
 */
export function resolveTemNovoAndamento(c: {
  tem_atualizacao_pos_retorno?: boolean | null;
  djen_nova_comunicacao?: boolean | null;
  tem_novo_andamento?: boolean | null;
}): boolean {
  return !!(c.tem_atualizacao_pos_retorno || c.djen_nova_comunicacao || c.tem_novo_andamento);
}

/**
 * Merge de flags no SCAN (idempotente).
 * Nunca força false só porque “nesta passagem não houve alerta novo”.
 * false definitivo: só atendimento / clear explícito (fora desta função).
 */
export function mergeFlagAlerta(
  alertaNestaPassagem: boolean,
  flagAnterior: boolean | null | undefined,
  fonteOk: boolean
): boolean | undefined {
  if (!fonteOk) return undefined; // não tocar no banco
  if (alertaNestaPassagem) return true;
  if (flagAnterior) return true;
  return false; // só chega aqui se já era false e não há alerta novo
}

/** Campos a zerar SOMENTE no atendimento humano ou clearDataJudAudit */
export const FLAGS_ATENDIMENTO_CLEAR = [
  'tem_atualizacao_pos_retorno',
  'tem_novo_andamento',
  'djen_nova_comunicacao',
] as const;

export function patchClearNovidade(): Record<string, boolean> {
  return {
    tem_atualizacao_pos_retorno: false,
    tem_novo_andamento: false,
    djen_nova_comunicacao: false,
  };
}

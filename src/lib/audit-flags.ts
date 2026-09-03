/**
 * Contrato de flags do núcleo de auditoria (uso em case-actions).
 * CONGELADO: alterar só com checklist em docs/SCANNER_STABILITY.md
 *
 * @copyright 2026 Davi Alves Figueredo / W1 Capital Assessoria Financeira Ltda.
 */

import { mergeFlagAlerta } from './novidade';
import type { EventoTipo } from './case-logic';

const WEIGHT: Record<string, number> = {
  ba: 100,
  transito_ou_baixa: 90,
  transito_baixa: 90,
  sentenca_procedente: 85,
  sentenca_improcedente: 85,
  sentenca_parcial: 82,
  liminar: 80,
  audiencia_julgamento: 72,
  audiencia_instrucao: 70,
  audiencia_conciliacao: 68,
  cumprimento_sentenca: 60,
  novo_andamento_relevante: 40,
  rotina: 10,
};

export function eventWeight(t: string | null | undefined): number {
  if (!t) return 0;
  if (WEIGHT[t] != null) return WEIGHT[t];
  if (t.startsWith('sentenca')) return 82;
  if (t.startsWith('audiencia')) return 70;
  if (t.includes('baixa') || t.includes('transito')) return 90;
  return 15;
}

/**
 * Só sobrescreve evento_* se o novo sinal for >= peso do atual.
 * Nunca grava rotina/null só porque “sem alteração nesta passagem”.
 */
export function mergeEventoMerito(
  currentTipo: EventoTipo | string | null | undefined,
  currentResumo: string | null | undefined,
  nextTipo: EventoTipo | string | null | undefined,
  nextResumo: string | null | undefined
): { evento_tipo: EventoTipo | string; evento_resumo: string | null } {
  const cur = (currentTipo as string) || 'rotina';
  const nxt = nextTipo as string | null;
  if (!nxt) {
    return {
      evento_tipo: cur,
      evento_resumo: currentResumo || null,
    };
  }
  if (eventWeight(nxt) >= eventWeight(cur)) {
    return {
      evento_tipo: nxt,
      evento_resumo: nextResumo || currentResumo || null,
    };
  }
  return {
    evento_tipo: cur,
    evento_resumo: currentResumo || null,
  };
}

export function buildIdempotentAlertFlags(input: {
  datajudOk: boolean;
  djenOk: boolean;
  alertaDatajud: boolean;
  alertaDjen: boolean;
  prevDatajud: boolean | null | undefined;
  prevDjen: boolean | null | undefined;
}): {
  tem_atualizacao_pos_retorno?: boolean;
  djen_nova_comunicacao?: boolean;
} {
  const out: {
    tem_atualizacao_pos_retorno?: boolean;
    djen_nova_comunicacao?: boolean;
  } = {};

  const fDj = mergeFlagAlerta(input.alertaDatajud, input.prevDatajud);
  if (fDj !== undefined) out.tem_atualizacao_pos_retorno = fDj;

  const fDjen = mergeFlagAlerta(input.alertaDjen, input.prevDjen);
  if (fDjen !== undefined) out.djen_nova_comunicacao = fDjen;

  return out;
}


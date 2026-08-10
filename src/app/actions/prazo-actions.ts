'use server';

/**
 * Action de contagem de prazo — 100% local (sem API externa paga).
 */
import {
  contarPrazo,
  type ContagemInput,
  type ContagemResult,
} from '@/lib/prazo-cpc-engine';

export async function calcularPrazoAction(
  input: ContagemInput
): Promise<ContagemResult> {
  try {
    return contarPrazo(input);
  } catch (e: any) {
    return {
      inicioContagem: '',
      vencimento: '',
      vencimentoLabel: '',
      diasSolicitados: input.dias || 0,
      modo: input.modo || 'uteis',
      uf: null,
      recessoAtingido: false,
      feriadosPulados: [],
      observacao: e?.message || 'Falha na contagem',
      ok: false,
    };
  }
}

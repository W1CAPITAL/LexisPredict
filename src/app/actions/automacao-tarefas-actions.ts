'use server';

/**
 * Server Action — automação de tarefas jurídicas a partir da carteira.
 */
import { getUserContext, getStoredCasesForEmpresa } from '@/lib/server-db';
import {
  gerarTarefasJuridicas,
  resumoAutomacaoTarefas,
} from '@/lib/automacao-tarefas';

export async function gerarTarefasJuridicasAction(limit = 50) {
  try {
    const { empresa_id } = await getUserContext();
    if (!empresa_id) {
      return { success: false as const, error: 'Sessão expirada.', tarefas: [] };
    }
    const cases = await getStoredCasesForEmpresa(empresa_id);
    const tarefas = gerarTarefasJuridicas(cases || [], { limit });
    const resumo = resumoAutomacaoTarefas(cases || []);
    return {
      success: true as const,
      tarefas,
      resumo: {
        total: resumo.total,
        criticas: resumo.criticas,
        byTipo: resumo.byTipo,
      },
    };
  } catch (e: any) {
    return {
      success: false as const,
      error: e?.message || 'Falha',
      tarefas: [],
    };
  }
}

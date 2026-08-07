/**
 * @copyright 2026 Davi Alves Figueredo / W1 Capital Assessoria Financeira Ltda.
 * @fileOverview Construtor Dinâmico de Contexto.
 */

import { getUserContext, getStoredCases, getStoredNotes } from '@/lib/server-db';

export async function buildDynamicContext() {
  console.log('[CONTEXT] Iniciando extração de dados do gabinete...');
  
  try {
    const [userCtx, cases, notes] = await Promise.all([
      getUserContext(),
      getStoredCases(),
      getStoredNotes()
    ]);

    const activeCases = cases.slice(0, 50).map(c => ({
      cliente: c.cliente,
      status: c.status,
      tribunal: c.tribunal,
      prazo: c.proximoPrazo
    }));

    return `
DADOS DO GABINETE:
Empresa: ${userCtx.empresa_id}
Usuário: ${userCtx.email} (${userCtx.cargo})
Total de Processos: ${cases.length}
Exemplos de Processos Ativos: ${JSON.stringify(activeCases)}
Notas Recentes: ${JSON.stringify(notes.slice(0, 10).map(n => n.content))}
    `.trim();
  } catch (e) {
    console.warn('[CONTEXT] Falha ao extrair contexto completo, usando contexto básico.');
    return "Contexto básico: LexisPredict Operating Mode.";
  }
}

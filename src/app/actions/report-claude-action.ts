'use server';

/**
 * Parecer Claude AI para relatório / dossiê operacional agregado.
 */
export async function generateRelatorioClaudeAction(input: {
  resumoCarteira: string;
  useClaude?: boolean;
}) {
  if (input.useClaude === false) {
    return { success: false as const, error: 'Claude desativado' };
  }
  try {
    const { analyzeCaseWithClaude } = await import('@/lib/ai/claude-surfaces');
    const r = await analyzeCaseWithClaude(input.resumoCarteira, 'relatorio', true);
    if (!r) return { success: false as const, error: 'Sem resposta' };
    console.info('[relatorio-claude]', r.logLine);
    return {
      success: true as const,
      texto: r.text,
      engine: r.engineLabel,
      logLine: r.logLine,
    };
  } catch (e: any) {
    return { success: false as const, error: e?.message || 'Falha Claude' };
  }
}

'use server';

import { classifyCaseEventsWithAi } from '@/lib/ai/case-event-classifier';
import { mergeAiIntoScanPatch } from '@/lib/ai/merge-scan-patch';

/**
 * Enrich do scanner DataJud/DJEN com Claude via OmniRoute (padrão).
 * SCAN_AI=0 desliga. SCAN_AI_PREFERRED=claude|omniroute|groq|auto
 */
export async function enrichScanPatchWithAi(opts: {
  protocolo: string;
  cliente?: string;
  movimentos: any[];
  comunicacoes: any[];
  patch: Record<string, any>;
  preferred?: string;
  enabled?: boolean;
}): Promise<{
  patch: Record<string, any>;
  aiEngine: string | null;
  aiLogLine: string | null;
  aiFlagsLabel: string | null;
}> {
  if (opts.enabled === false)
    return { patch: opts.patch, aiEngine: null, aiLogLine: null, aiFlagsLabel: null };
  if (process.env.SCAN_AI === '0' || process.env.SCAN_AI === 'false') {
    return { patch: opts.patch, aiEngine: null, aiLogLine: null, aiFlagsLabel: null };
  }

  const hasMaterial =
    (opts.movimentos && opts.movimentos.length > 0) ||
    (opts.comunicacoes && opts.comunicacoes.length > 0);
  if (!hasMaterial)
    return { patch: opts.patch, aiEngine: null, aiLogLine: null, aiFlagsLabel: null };

  // Padrão: Claude (OmniRoute) — o que o usuário configurou no app
  const preferred =
    opts.preferred ||
    process.env.SCAN_AI_PREFERRED ||
    process.env.LEXIS_SCAN_AI ||
    'claude';

  const ai = await classifyCaseEventsWithAi({
    protocolo: opts.protocolo,
    cliente: opts.cliente,
    movimentos: opts.movimentos,
    comunicacoes: opts.comunicacoes,
    preferred,
  });
  if (!ai)
    return { patch: opts.patch, aiEngine: null, aiLogLine: null, aiFlagsLabel: null };

  const patch = mergeAiIntoScanPatch(opts.patch, ai);

  return {
    patch,
    aiEngine: ai.engine,
    aiLogLine: patch.ai_log_line || null,
    aiFlagsLabel: patch.ai_flags_label || null,
  };
}

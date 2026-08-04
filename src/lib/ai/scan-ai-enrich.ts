'use server';

import { classifyCaseEventsWithAi } from '@/lib/ai/case-event-classifier';
import { mergeAiIntoScanPatch } from '@/lib/ai/merge-scan-patch';

export async function enrichScanPatchWithAi(opts: {
  protocolo: string;
  cliente?: string;
  movimentos: any[];
  comunicacoes: any[];
  patch: Record<string, any>;
  preferred?: string;
  enabled?: boolean;
}): Promise<{ patch: Record<string, any>; aiEngine: string | null }> {
  if (opts.enabled === false) return { patch: opts.patch, aiEngine: null };
  if (process.env.SCAN_AI === '0' || process.env.SCAN_AI === 'false') {
    return { patch: opts.patch, aiEngine: null };
  }
  const hasMaterial =
    (opts.movimentos && opts.movimentos.length > 0) ||
    (opts.comunicacoes && opts.comunicacoes.length > 0);
  if (!hasMaterial) return { patch: opts.patch, aiEngine: null };

  const ai = await classifyCaseEventsWithAi({
    protocolo: opts.protocolo,
    cliente: opts.cliente,
    movimentos: opts.movimentos,
    comunicacoes: opts.comunicacoes,
    preferred: opts.preferred || process.env.SCAN_AI_PREFERRED || 'groq',
  });
  if (!ai) return { patch: opts.patch, aiEngine: null };
  return { patch: mergeAiIntoScanPatch(opts.patch, ai), aiEngine: ai.engine };
}

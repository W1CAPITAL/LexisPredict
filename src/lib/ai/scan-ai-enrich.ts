/**
 * Ponte scanner → classificador AI (OmniRoute/Claude).
 * Chamar DEPOIS das heurísticas DataJud/DJEN, ANTES de persistir o patch.
 */
'use server';

import {
  classifyCaseEventsWithAi,
  mergeAiIntoScanPatch,
} from '@/lib/ai/case-event-classifier';

export async function enrichScanPatchWithAi(opts: {
  protocolo: string;
  cliente?: string;
  movimentos: any[];
  comunicacoes: any[];
  patch: Record<string, any>;
  preferred?: string;
  /** desliga por env SCAN_AI=0 */
  enabled?: boolean;
}): Promise<{ patch: Record<string, any>; aiEngine: string | null }> {
  if (opts.enabled === false) return { patch: opts.patch, aiEngine: null };
  if (process.env.SCAN_AI === '0' || process.env.SCAN_AI === 'false') {
    return { patch: opts.patch, aiEngine: null };
  }

  // Só chama IA se há material novo ou flags já interessantes (economia de token)
  const hasMaterial =
    (opts.movimentos && opts.movimentos.length > 0) ||
    (opts.comunicacoes && opts.comunicacoes.length > 0);
  if (!hasMaterial) return { patch: opts.patch, aiEngine: null };

  const ai = await classifyCaseEventsWithAi({
    protocolo: opts.protocolo,
    cliente: opts.cliente,
    movimentos: opts.movimentos,
    comunicacoes: opts.comunicacoes,
    preferred: opts.preferred || process.env.SCAN_AI_PREFERRED || 'claude',
  });

  if (!ai) return { patch: opts.patch, aiEngine: null };
  return {
    patch: mergeAiIntoScanPatch(opts.patch, ai),
    aiEngine: ai.engine,
  };
}

'use server';

import { classifyCaseEventsWithAi } from '@/lib/ai/case-event-classifier';
import { mergeAiIntoScanPatch } from '@/lib/ai/merge-scan-patch';

/**
 * Enrich do scanner DataJud/DJEN com Claude (OmniRoute) prioritário.
 * preferred padrão: claude (cascade cai em openrouter/groq se falhar).
 */
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

  const preferred =
    opts.preferred ||
    process.env.SCAN_AI_PREFERRED ||
    'claude';

  const ai = await classifyCaseEventsWithAi({
    protocolo: opts.protocolo,
    cliente: opts.cliente,
    movimentos: opts.movimentos,
    comunicacoes: opts.comunicacoes,
    preferred,
  });
  if (!ai) return { patch: opts.patch, aiEngine: null };

  let patch = mergeAiIntoScanPatch(opts.patch, ai);

  // Espelha flags de mérito / BA tipado no patch
  const f = ai.flags || ({} as any);
  patch = {
    ...patch,
    ai_evento_tipo: ai.evento_tipo,
    ai_evento_resumo: ai.evento_resumo,
    ai_severidade: ai.severidade,
    ai_engine: ai.engine,
    sentenca_procedente: !!f.procedente,
    sentenca_improcedente: !!f.improcedente,
    sentenca_parcial: !!f.parcial,
    cumprimento_sentenca: !!f.cumprimento_sentenca || !!patch.cumprimento_sentenca,
    indicio_busca_apreensao: !!f.busca_apreensao,
    ba_tipo: f.ba_tipo || null,
    datajud_encerrado_tribunal:
      !!f.encerrado || !!patch.datajud_encerrado_tribunal,
  };

  return { patch, aiEngine: ai.engine };
}

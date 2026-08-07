/**
 * Confirmação BA via Claude (OmniRoute / Anthropic / OpenRouter cascade).
 * Retorna tipo tipado + se deve alertar.
 */
'use server';

import { runCascade } from '@/lib/ai/cascade';
import type { BaTipo } from '@/lib/busca-apreensao-logic';

export type BaClaudeResult = {
  isBa: boolean;
  confidence: number;
  reason: string;
  tipo: BaTipo;
  engine?: string;
};

export async function confirmBuscaApreensaoComClaude(
  teor: string,
  preferred = 'claude'
): Promise<BaClaudeResult> {
  const t = String(teor || '').trim();
  if (t.length < 30) {
    return { isBa: false, confidence: 0, reason: 'Teor insuficiente.', tipo: null };
  }
  try {
    const r = await runCascade({
      preferred,
      forceEngineId: preferred === 'auto' ? undefined : preferred,
      system: `Classifique publicação do diário oficial BR. SOMENTE JSON:
{"is_ba":boolean,"confidence":0-1,"tipo":"VEICULO"|"PRISAO"|"PENHORA_BENS"|"IMOVEL"|"GENERICO"|null,"reason":"string curta"}
is_ba=true só para mandado/ordem real de busca e apreensão de bem, penhora relevante ou mandado de prisão.
Menção incidental, ementa de terceiro ou só nome de classe = is_ba false.`,
      messages: [{ role: 'user', content: t.slice(0, 8000) }],
      max_tokens: 280,
      temperature: 0,
    });
    const m = r.text.match(/\{[\s\S]*\}/);
    if (!m) {
      return {
        isBa: false,
        confidence: 0,
        reason: 'Resposta sem JSON.',
        tipo: null,
        engine: r.engineId,
      };
    }
    const j = JSON.parse(m[0]);
    const tipo = (j.tipo as BaTipo) || (j.is_ba ? 'GENERICO' : null);
    return {
      isBa: !!j.is_ba,
      confidence: Number(j.confidence) || 0,
      reason: String(j.reason || ''),
      tipo,
      engine: `${r.engineId}:${r.model}`,
    };
  } catch (e: any) {
    return {
      isBa: false,
      confidence: 0,
      reason: e?.message || 'Claude indisponível',
      tipo: null,
    };
  }
}

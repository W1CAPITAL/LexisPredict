/**
 * Confirmação opcional de Busca e Apreensão via Claude (Messages API).
 * Usado quando o usuário ativa "Claude + DJEN · BA" no Núcleo Neural.
 */
'use server';

import { runCascade } from '@/lib/ai/cascade';

export type BaClaudeResult = {
  isBa: boolean;
  confidence: number;
  reason: string;
  engine?: string;
};

export async function confirmBuscaApreensaoComClaude(
  teor: string,
  preferred = 'claude'
): Promise<BaClaudeResult> {
  const t = String(teor || '').trim();
  if (t.length < 30) {
    return { isBa: false, confidence: 0, reason: 'Teor insuficiente.' };
  }
  try {
    const r = await runCascade({
      preferred,
      forceEngineId: 'claude',
      system:
        'Classifique publicação do diário oficial brasileiro. Responda SOMENTE JSON: {"is_ba":boolean,"confidence":number,"reason":"string curta"}. is_ba=true apenas para mandado/ordem de busca e apreensão de bem (veículo, etc.). Menção incidental não conta.',
      messages: [{ role: 'user', content: t.slice(0, 8000) }],
      max_tokens: 250,
      temperature: 0,
    });
    const m = r.text.match(/\{[\s\S]*\}/);
    if (!m) {
      return {
        isBa: false,
        confidence: 0,
        reason: 'Resposta Claude sem JSON.',
        engine: r.engineId,
      };
    }
    const j = JSON.parse(m[0]);
    return {
      isBa: !!j.is_ba,
      confidence: Number(j.confidence) || 0,
      reason: String(j.reason || ''),
      engine: `${r.engineId}:${r.model}`,
    };
  } catch (e: any) {
    return {
      isBa: false,
      confidence: 0,
      reason: e?.message || 'Claude indisponível',
    };
  }
}

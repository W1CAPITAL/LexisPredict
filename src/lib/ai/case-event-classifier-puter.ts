/**
 * Classificador via Puter.js (browser, user-pays) — fallback quando servidor sem key.
 * Usar só no client ("use client").
 */
"use client";

export type PuterClassification = {
  evento_tipo: string;
  evento_resumo: string;
  alertar: boolean;
  engine: string;
};

export async function classifyWithPuter(prompt: string): Promise<PuterClassification | null> {
  if (typeof window === 'undefined') return null;
  try {
    // Puter global (CDN) ou dynamic import
    const puter = (window as any).puter;
    if (!puter?.ai?.chat) {
      console.warn('[Puter] puter.ai.chat indisponível');
      return null;
    }
    const text = await puter.ai.chat(
      [
        {
          role: 'system',
          content:
            'Classifique andamento jurídico BR. JSON: {"evento_tipo":"...","evento_resumo":"...","alertar":bool}',
        },
        { role: 'user', content: prompt.slice(0, 6000) },
      ],
      { model: 'claude-sonnet-4-5' }
    );
    const raw = typeof text === 'string' ? text : String(text?.message || text || '');
    const m = raw.match(/\{[\s\S]*\}/);
    if (!m) return null;
    const j = JSON.parse(m[0]);
    return {
      evento_tipo: j.evento_tipo || 'rotina',
      evento_resumo: j.evento_resumo || '',
      alertar: !!j.alertar,
      engine: 'puter:claude',
    };
  } catch (e) {
    console.error('[Puter classify]', e);
    return null;
  }
}

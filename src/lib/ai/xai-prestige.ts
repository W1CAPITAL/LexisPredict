/**
 * xAI Grok (Prestige / API) — motor legítimo para o Assistente Lexis.
 * NAO e WormGPT uncensored: prompt de gabinete juridico, sem jailbreak.
 *
 * Env (Vercel):
 *   XAI_GROK_PRESTIGE_API_KEY  (preferencial)
 *   XAI_API_KEY
 *   GROK_API_KEY
 *   XAI_MODEL  (ex.: grok-2-1212, grok-3, grok-3-mini)
 *   XAI_BASE_URL  (default https://api.x.ai/v1)
 */
export type XaiResult = {
  text: string;
  engine: string;
  model: string;
  latencyMs: number;
  tokens?: number;
};

function xaiKey(): string {
  return (
    process.env.XAI_GROK_PRESTIGE_API_KEY ||
    process.env.XAI_API_KEY ||
    process.env.GROK_API_KEY ||
    ''
  ).trim();
}

function xaiBase(): string {
  let b = (process.env.XAI_BASE_URL || 'https://api.x.ai/v1').trim().replace(/\/+$/, '');
  if (b.endsWith('/chat/completions')) b = b.replace(/\/chat\/completions$/, '');
  return b;
}

export function isXaiConfigured(): boolean {
  return !!xaiKey();
}

export async function callXaiPrestige(
  messages: Array<{ role: string; content: string }>,
  opts?: { model?: string; max_tokens?: number; temperature?: number }
): Promise<XaiResult> {
  const key = xaiKey();
  if (!key) throw new Error('XAI_GROK_PRESTIGE_API_KEY / XAI_API_KEY ausente');

  const model =
    opts?.model ||
    process.env.XAI_MODEL ||
    process.env.XAI_PRESTIGE_MODEL ||
    'grok-2-1212';

  const t0 = Date.now();
  const res = await fetch(`${xaiBase()}/chat/completions`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${key}`,
      accept: 'application/json',
    },
    body: JSON.stringify({
      model,
      messages,
      max_tokens: opts?.max_tokens ?? 4096,
      temperature: opts?.temperature ?? 0.4,
      stream: false,
    }),
    signal: AbortSignal.timeout(90000),
  });

  const raw = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(
      (raw as any)?.error?.message || (raw as any)?.error || `xAI HTTP ${res.status}`
    );
  }
  const text =
    (raw as any)?.choices?.[0]?.message?.content ||
    (raw as any)?.choices?.[0]?.text ||
    '';
  if (!String(text).trim()) throw new Error('xAI resposta vazia');

  return {
    text: String(text).trim(),
    engine: 'xai-prestige',
    model: (raw as any)?.model || model,
    latencyMs: Date.now() - t0,
    tokens: (raw as any)?.usage?.total_tokens,
  };
}

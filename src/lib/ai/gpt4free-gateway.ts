/**
 * Gateway OpenAI-compatible inspirado em gpt4free-ts / gptgod.
 * Fallback gratuito opcional quando Claude/OmniRoute/Groq falham.
 *
 * Env:
 *   GPT4FREE_BASE_URL  (ex.: https://api.gptgod.online  ou http://localhost:3000)
 *   GPT4FREE_API_KEY
 *   GPT4FREE_MODEL     (ex.: gpt-3.5-turbo, mixtral-8x7b, claude-1-100k)
 *   GPT4FREE_SITE      (opcional: path site do self-host gpt4free-ts, ex. you)
 *
 * Nao use em producao como unica fonte — instavel e terceiros.
 */
export type G4fResult = { text: string; engine: string; latencyMs: number };

function cleanBase(raw?: string | null): string {
  if (!raw) return '';
  let s = String(raw).trim().replace(/^[=]+/, '').replace(/\/+$/, '');
  const cut = s.indexOf('/chat/completions');
  if (cut > 0) s = s.slice(0, cut);
  if (s.endsWith('/v1')) s = s.slice(0, -3);
  return s;
}

export async function callGpt4Free(
  messages: Array<{ role: string; content: string }>,
  opts?: { model?: string; max_tokens?: number; temperature?: number }
): Promise<G4fResult> {
  const base = cleanBase(
    process.env.GPT4FREE_BASE_URL ||
      process.env.GPTGOD_BASE_URL ||
      process.env.G4F_BASE_URL ||
      ''
  );
  if (!base) throw new Error('GPT4FREE_BASE_URL nao configurada');

  const key =
    process.env.GPT4FREE_API_KEY ||
    process.env.GPTGOD_API_KEY ||
    process.env.G4F_API_KEY ||
    'sk-gpt4free';

  const site = (process.env.GPT4FREE_SITE || '').replace(/^\/+|\/+$/g, '');
  // Self-host gpt4free-ts: /:site/v1/chat/completions  |  gptgod: /v1/chat/completions
  const path = site
    ? `/${site}/v1/chat/completions`
    : `/v1/chat/completions`;

  const model =
    opts?.model ||
    process.env.GPT4FREE_MODEL ||
    process.env.GPTGOD_MODEL ||
    'gpt-3.5-turbo';

  const t0 = Date.now();
  const url = `${base}${path}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${key}`,
      accept: 'application/json',
    },
    body: JSON.stringify({
      model,
      messages,
      max_tokens: opts?.max_tokens ?? 2048,
      temperature: opts?.temperature ?? 0.4,
      stream: false,
    }),
    signal: AbortSignal.timeout(60000),
  });

  const rawText = await res.text();
  let raw: any = {};
  try {
    raw = JSON.parse(rawText);
  } catch {
    throw new Error(`gpt4free JSON invalido HTTP ${res.status}`);
  }
  if (!res.ok) {
    throw new Error(raw?.error?.message || `gpt4free HTTP ${res.status}`);
  }
  const text =
    raw?.choices?.[0]?.message?.content ||
    raw?.choices?.[0]?.text ||
    raw?.content ||
    '';
  if (!String(text).trim()) throw new Error('gpt4free resposta vazia');
  return {
    text: String(text).trim(),
    engine: `gpt4free:${model}`,
    latencyMs: Date.now() - t0,
  };
}

export function isGpt4FreeConfigured(): boolean {
  return !!cleanBase(
    process.env.GPT4FREE_BASE_URL || process.env.GPTGOD_BASE_URL || process.env.G4F_BASE_URL
  );
}

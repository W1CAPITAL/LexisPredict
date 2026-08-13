/**
 * MiniMax API — Anthropic-compatible + OpenAI-compatible.
 * Docs: https://platform.minimax.io/docs/api-reference/text-anthropic-api
 * Base (global): https://api.minimax.io
 */
export function isMinimaxConfigured(): boolean {
  return !!(
    process.env.MINIMAX_API_KEY ||
    process.env.MINIMAX_KEY ||
    process.env.MINIMAX_GROUP_API_KEY
  );
}

function minimaxKey(): string {
  return (
    process.env.MINIMAX_API_KEY ||
    process.env.MINIMAX_KEY ||
    process.env.MINIMAX_GROUP_API_KEY ||
    ''
  ).trim();
}

function anthropicBase(): string {
  return (
    process.env.MINIMAX_ANTHROPIC_BASE_URL ||
    process.env.MINIMAX_BASE_URL_ANTHROPIC ||
    'https://api.minimax.io/anthropic'
  ).replace(/\/$/, '');
}

function openaiBase(): string {
  return (
    process.env.MINIMAX_OPENAI_BASE_URL ||
    process.env.MINIMAX_BASE_URL ||
    'https://api.minimax.io/v1'
  ).replace(/\/$/, '');
}

function modelId(): string {
  return process.env.MINIMAX_MODEL || process.env.MINIMAX_TEXT_MODEL || 'MiniMax-M3';
}

function extractAnthropicText(raw: any): string {
  const blocks = raw?.content;
  if (Array.isArray(blocks)) {
    return blocks
      .filter((b: any) => b?.type === 'text' && b?.text)
      .map((b: any) => String(b.text))
      .join('\n')
      .trim();
  }
  return String(raw?.text || raw?.output_text || '').trim();
}

export async function callMinimax(
  messages: Array<{ role: string; content: string }>,
  opts?: { max_tokens?: number; temperature?: number; thinking?: boolean }
): Promise<{ text: string; model: string; latencyMs: number; engine: string }> {
  const key = minimaxKey();
  if (!key) throw new Error('MINIMAX_API_KEY ausente');

  const model = modelId();
  const max_tokens = opts?.max_tokens ?? 4096;
  const temperature = opts?.temperature ?? 0.4;
  const t0 = Date.now();

  // 1) Anthropic-compatible (recomendado pela MiniMax)
  try {
    const system = messages.find((m) => m.role === 'system')?.content;
    const turns = messages
      .filter((m) => m.role === 'user' || m.role === 'assistant')
      .map((m) => ({
        role: m.role,
        content: [{ type: 'text', text: String(m.content || '').slice(0, 120000) }],
      }));

    const body: Record<string, unknown> = {
      model,
      max_tokens,
      messages: turns.length ? turns : [{ role: 'user', content: [{ type: 'text', text: '...' }] }],
    };
    if (system) body.system = String(system).slice(0, 20000);
    // thinking control (docs) — adaptive quando habilitado
    if (opts?.thinking !== false) {
      body.thinking = { type: process.env.MINIMAX_THINKING || 'disabled' };
    }

    const res = await fetch(`${anthropicBase()}/v1/messages`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${key}`,
        'x-api-key': key,
        accept: 'application/json',
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(90000),
    });
    const raw = await res.json().catch(() => ({}));
    if (res.ok) {
      const text = extractAnthropicText(raw);
      if (text) {
        return { text, model, latencyMs: Date.now() - t0, engine: 'minimax' };
      }
    }
    // se Anthropic falhar, tenta OpenAI shape
    if (res.status === 401 || res.status === 403) {
      throw new Error(`minimax anthropic HTTP ${res.status}: ${(raw as any)?.error?.message || ''}`);
    }
  } catch (e: any) {
    if (String(e?.message || '').includes('HTTP 401') || String(e?.message || '').includes('HTTP 403')) {
      throw e;
    }
    // continua OpenAI
  }

  // 2) OpenAI-compatible
  const res2 = await fetch(`${openaiBase()}/chat/completions`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${key}`,
      accept: 'application/json',
    },
    body: JSON.stringify({
      model,
      messages: messages.map((m) => ({
        role: m.role,
        content: String(m.content || '').slice(0, 100000),
      })),
      max_tokens,
      temperature,
      stream: false,
    }),
    signal: AbortSignal.timeout(90000),
  });
  const raw2 = await res2.json().catch(() => ({}));
  if (!res2.ok) {
    throw new Error(
      (raw2 as any)?.error?.message || `minimax openai HTTP ${res2.status}`
    );
  }
  const text2 =
    (raw2 as any)?.choices?.[0]?.message?.content ||
    extractAnthropicText(raw2) ||
    '';
  if (!String(text2).trim()) throw new Error('minimax vazio');
  return {
    text: String(text2).trim(),
    model,
    latencyMs: Date.now() - t0,
    engine: 'minimax',
  };
}

/**
 * Gateway grátis Lexis — SEM OmniRoute, SEM instalar nada no PC.
 * Ordem: env keys (Anthropic/Groq/xAI/OpenRouter/Gemini) → Pollinations (sem key) → erro claro.
 * Use em toda superfície de IA no lugar de depender do Render/Omni.
 */

export type FreeMsg = { role: 'system' | 'user' | 'assistant'; content: string };

export type FreeResult = {
  text: string;
  engine: string;
  latencyMs: number;
};

function compact(s: string, max = 12000) {
  return String(s || '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, max);
}

/** Pollinations — OpenAI-compatible, sem API key (rate limit público) */
async function callPollinations(messages: FreeMsg[], max_tokens = 2048): Promise<FreeResult> {
  const t0 = Date.now();
  // endpoint público documentado pela comunidade Pollinations
  const url = 'https://text.pollinations.ai/openai';
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      model: 'openai',
      messages: messages.map((m) => ({ role: m.role, content: compact(m.content, 6000) })),
      max_tokens,
    }),
    signal: AbortSignal.timeout(60000),
  });
  const raw = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((raw as any)?.error?.message || `Pollinations HTTP ${res.status}`);
  }
  const text =
    (raw as any)?.choices?.[0]?.message?.content ||
    (typeof raw === 'string' ? raw : '') ||
    (raw as any)?.content ||
    '';
  if (!String(text).trim()) throw new Error('Pollinations vazio');
  return { text: String(text).trim(), engine: 'pollinations:openai', latencyMs: Date.now() - t0 };
}

async function callOpenAIShape(
  url: string,
  key: string,
  model: string,
  messages: FreeMsg[],
  label: string,
  extraHeaders?: Record<string, string>
): Promise<FreeResult> {
  const t0 = Date.now();
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${key}`,
      ...(extraHeaders || {}),
    },
    body: JSON.stringify({
      model,
      messages: messages.map((m) => ({ role: m.role, content: compact(m.content, 8000) })),
      max_tokens: 4096,
      temperature: 0.3,
    }),
    signal: AbortSignal.timeout(90000),
  });
  const raw = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((raw as any)?.error?.message || `${label} HTTP ${res.status}`);
  }
  const text = (raw as any)?.choices?.[0]?.message?.content || '';
  if (!String(text).trim()) throw new Error(`${label} vazio`);
  return { text: String(text).trim(), engine: `${label}:${model}`, latencyMs: Date.now() - t0 };
}

async function callAnthropicDirect(messages: FreeMsg[]): Promise<FreeResult> {
  const key =
    process.env.ANTHROPIC_API_KEY ||
    process.env.CLAUDE_API_KEY ||
    process.env.ANTHROPIC_KEY;
  if (!key) throw new Error('sem anthropic');
  const t0 = Date.now();
  const system = messages.find((m) => m.role === 'system')?.content;
  const turns = messages
    .filter((m) => m.role === 'user' || m.role === 'assistant')
    .map((m) => ({ role: m.role, content: compact(m.content, 8000) }));
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: process.env.ANTHROPIC_MODEL || process.env.CLAUDE_MODEL || 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      system: system || undefined,
      messages: turns,
    }),
    signal: AbortSignal.timeout(90000),
  });
  const raw = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((raw as any)?.error?.message || `Anthropic HTTP ${res.status}`);
  }
  const text = Array.isArray((raw as any)?.content)
    ? (raw as any).content.filter((b: any) => b.type === 'text').map((b: any) => b.text).join('\n')
    : '';
  if (!text.trim()) throw new Error('Anthropic vazio');
  return {
    text: text.trim(),
    engine: `anthropic:${process.env.ANTHROPIC_MODEL || 'claude'}`,
    latencyMs: Date.now() - t0,
  };
}

/**
 * Ponto único: tenta tudo que der, inclusive zero-key.
 */
export async function freeComplete(opts: {
  system?: string;
  user: string;
  history?: Array<{ role: 'user' | 'assistant'; content: string }>;
}): Promise<FreeResult> {
  const messages: FreeMsg[] = [];
  if (opts.system) messages.push({ role: 'system', content: compact(opts.system, 4000) });
  for (const h of (opts.history || []).slice(-8)) {
    messages.push({ role: h.role, content: compact(h.content, 2000) });
  }
  messages.push({ role: 'user', content: compact(opts.user, 6000) });

  const errors: string[] = [];

  // 1) Anthropic
  try {
    return await callAnthropicDirect(messages);
  } catch (e: any) {
    errors.push(`anthropic: ${e?.message || e}`);
  }

  // 2) Groq (free tier com key grátis no browser)
  const groq = process.env.GROQ_API_KEY || process.env.GROQ_KEY;
  if (groq) {
    try {
      return await callOpenAIShape(
        'https://api.groq.com/openai/v1/chat/completions',
        groq,
        process.env.GROQ_MODEL || 'llama-3.3-70b-versatile',
        messages,
        'groq'
      );
    } catch (e: any) {
      errors.push(`groq: ${e?.message || e}`);
    }
  }

  // 3) OpenRouter free model
  const or = process.env.OPENROUTER_API_KEY;
  if (or) {
    try {
      return await callOpenAIShape(
        'https://openrouter.ai/api/v1/chat/completions',
        or,
        process.env.OPENROUTER_MODEL || 'openai/gpt-oss-20b:free',
        messages,
        'openrouter',
        {
          'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'https://private-assecom.vercel.app',
          'X-Title': 'LexisPredict',
        }
      );
    } catch (e: any) {
      errors.push(`openrouter: ${e?.message || e}`);
    }
  }

  // 4) xAI
  const xai =
    process.env.XAI_API_KEY ||
    process.env.XAI_GROK_PRESTIGE_API_KEY ||
    process.env.GROK_API_KEY;
  if (xai) {
    try {
      return await callOpenAIShape(
        'https://api.x.ai/v1/chat/completions',
        xai,
        process.env.XAI_MODEL || 'grok-2-1212',
        messages,
        'xai'
      );
    } catch (e: any) {
      errors.push(`xai: ${e?.message || e}`);
    }
  }

  // 5) Gemini
  const gem =
    process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (gem) {
    try {
      const t0 = Date.now();
      const model = process.env.GEMINI_MODEL || 'gemini-2.0-flash';
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${gem}`;
      const sys = messages.find((m) => m.role === 'system')?.content || '';
      const userParts = messages
        .filter((m) => m.role !== 'system')
        .map((m) => `${m.role}: ${m.content}`)
        .join('\n\n');
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: compact(`${sys}\n\n${userParts}`, 10000) }] }],
        }),
        signal: AbortSignal.timeout(60000),
      });
      const raw = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((raw as any)?.error?.message || `Gemini HTTP ${res.status}`);
      const text =
        (raw as any)?.candidates?.[0]?.content?.parts?.map((p: any) => p.text).join('') || '';
      if (!text.trim()) throw new Error('Gemini vazio');
      return { text: text.trim(), engine: `gemini:${model}`, latencyMs: Date.now() - t0 };
    } catch (e: any) {
      errors.push(`gemini: ${e?.message || e}`);
    }
  }

  // 6) Pollinations — SEM KEY (último recurso público)
  try {
    return await callPollinations(messages);
  } catch (e: any) {
    errors.push(`pollinations: ${e?.message || e}`);
  }

  throw new Error(
    `Nenhum motor disponível. Coloque no Vercel uma key grátis (GROQ_API_KEY ou OPENROUTER_API_KEY ou GEMINI_API_KEY ou ANTHROPIC_API_KEY). Detalhes: ${errors.slice(0, 4).join(' | ')}`
  );
}

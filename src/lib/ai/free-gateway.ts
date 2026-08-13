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
  /** Ex.: claude, groq, openrouter, xai, gemini */
  preferred?: string;
  /** Se true, NÃO tenta outros motores após falha do preferido */
  exclusive?: boolean;
}): Promise<FreeResult> {
  const messages: FreeMsg[] = [];
  if (opts.system) messages.push({ role: 'system', content: compact(opts.system, 4000) });
  for (const h of (opts.history || []).slice(-8)) {
    messages.push({ role: h.role, content: compact(h.content, 2000) });
  }
  messages.push({ role: 'user', content: compact(opts.user, 6000) });

  const errors: string[] = [];
  const pref = (opts.preferred || '').toLowerCase();
  const exclusive = !!opts.exclusive && !!pref && pref !== 'auto' && pref !== 'omni' && !pref.includes('omni');

  type Step = { id: string; run: () => Promise<FreeResult> };
  const steps: Step[] = [];

  const anthropicKey = process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY;
  if (anthropicKey) {
    steps.push({ id: 'claude', run: () => callAnthropicDirect(messages) });
  }
  const groq = process.env.GROQ_API_KEY || process.env.GROQ_KEY;
  if (groq) {
    steps.push({
      id: 'groq',
      run: () =>
        callOpenAIShape(
          'https://api.groq.com/openai/v1/chat/completions',
          groq,
          process.env.GROQ_MODEL || 'llama-3.3-70b-versatile',
          messages,
          'groq'
        ),
    });
  }
  const or = process.env.OPENROUTER_API_KEY;
  if (or) {
    steps.push({
      id: 'openrouter',
      run: () =>
        callOpenAIShape(
          'https://openrouter.ai/api/v1/chat/completions',
          or,
          process.env.OPENROUTER_MODEL || 'openai/gpt-oss-20b:free',
          messages,
          'openrouter',
          {
            'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'https://private-assecom.vercel.app',
            'X-Title': 'LexisPredict',
          }
        ),
    });
  }
  const xai =
    process.env.XAI_GROK_PRESTIGE_API_KEY ||
    process.env.XAI_API_KEY ||
    process.env.GROK_API_KEY;
  if (xai) {
    steps.push({
      id: 'xai',
      run: async () => {
        const { callXaiPrestige } = await import('@/lib/ai/xai-prestige');
        const r = await callXaiPrestige(messages as any, {
          max_tokens: 4096,
          temperature: 0.4,
        });
        return {
          text: r.text,
          engine: `${r.engine}:${r.model}`,
          latencyMs: r.latencyMs,
        };
      },
    });
  }
  const gem = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (gem) {
    steps.push({
      id: 'gemini',
      run: async () => {
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
          signal: AbortSignal.timeout(90000),
        });
        const raw = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error((raw as any)?.error?.message || `gemini HTTP ${res.status}`);
        }
        const text =
          (raw as any)?.candidates?.[0]?.content?.parts?.map((x: any) => x.text).join('\n') || '';
        if (!String(text).trim()) throw new Error('gemini vazio');
        return { text: String(text).trim(), engine: `gemini:${model}`, latencyMs: Date.now() - t0 };
      },
    });
  }



  // NVIDIA NIM
  const nvidiaKey = process.env.NVIDIA_API_KEY || process.env.NVIDIA_NIM_API_KEY;
  if (nvidiaKey) {
    steps.push({
      id: 'nvidia',
      run: async () => {
        const { callNvidiaNim } = await import('@/lib/ai/nvidia-nim');
        const r = await callNvidiaNim(messages as any, { max_tokens: 4096, temperature: 0.3 });
        return { text: r.text, engine: `nvidia:${r.model}`, latencyMs: r.latencyMs };
      },
    });
  }

  // GPT4Free / gptgod — fallback (https://github.com/xiangsx/gpt4free-ts)
  if (process.env.GPT4FREE_BASE_URL || process.env.GPTGOD_BASE_URL || process.env.G4F_BASE_URL) {
    steps.push({
      id: 'gpt4free',
      run: async () => {
        const { callGpt4Free } = await import('@/lib/ai/gpt4free-gateway');
        return callGpt4Free(messages as any, { max_tokens: 2048 });
      },
    });
  }

  // Ordena: preferred primeiro
  if (pref) {
    steps.sort((a, b) => {
      const as = pref.includes(a.id) || a.id.includes(pref.split(':')[0]) ? 0 : 1;
      const bs = pref.includes(b.id) || b.id.includes(pref.split(':')[0]) ? 0 : 1;
      return as - bs;
    });
  }

  let ordered = steps;
  if (exclusive) {
    ordered = steps.filter(
      (s) => pref.includes(s.id) || s.id.includes(pref.split(':')[0]) || pref === s.id
    );
    if (ordered.length === 0) ordered = steps.slice(0, 1); // evita lista vazia se typo
  }

  const isTransient = (msg: string) => {
    const m = (msg || '').toLowerCase();
    return (
      m.includes('429') ||
      m.includes('402') ||
      m.includes('401') ||
      m.includes('403') ||
      m.includes('quota') ||
      m.includes('rate') ||
      m.includes('credit') ||
      m.includes('token') ||
      m.includes('billing') ||
      m.includes('insufficient') ||
      m.includes('overloaded') ||
      m.includes('capacity') ||
      m.includes('timeout') ||
      m.includes('econn') ||
      m.includes('fetch failed') ||
      m.includes('vazio') ||
      m.includes('empty')
    );
  };

  for (const step of ordered) {
    try {
      return await step.run();
    } catch (e: any) {
      const msg = String(e?.message || e);
      errors.push(`${step.id}: ${msg}`);
      // Mesmo em exclusive: se esgotou token/quota/auth, tenta o PRÓXIMO motor
      if (exclusive && !isTransient(msg)) break;
    }
  }

  // Pollinations: sempre como último recurso (inclusive se Claude/Groq falharam)
  try {
    return await callPollinations(messages);
  } catch (e: any) {
    errors.push(`pollinations: ${e?.message || e}`);
  }

  throw new Error(
    `Nenhum motor disponível. ${errors.join(' | ') || 'Configure GROQ_API_KEY / OPENROUTER / ANTHROPIC no Vercel.'}`
  );
}

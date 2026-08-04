/**
 * Cascata Lexis — API estável para provider, veredito, chat, BA.
 * OmniRoute opcional; free gateway (Groq/Anthropic/OpenRouter/Pollinations).
 */
import { freeComplete } from '@/lib/ai/free-gateway';

export type CascadeEngine = {
  id: string;
  url: string;
  key?: string;
  model: string;
  kind?: 'openai' | 'anthropic' | 'omniroute';
};

export type ChatTurn = { role: 'user' | 'assistant' | 'system'; content: string };
export type VisionImage = {
  mediaType: 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp';
  data: string;
};

export type CascadeCallOptions = {
  preferred?: string;
  system?: string;
  messages: ChatTurn[];
  images?: VisionImage[];
  temperature?: number;
  max_tokens?: number;
  forceEngineId?: string;
  surface?: string;
  tribunalContext?: string;
  noTokenSaver?: boolean;
};

export type CascadeResult = {
  text: string;
  engineId: string;
  model: string;
  latencyMs: number;
  tokens?: number;
  latency?: number;
  tokensIn?: number;
  tokensOut?: number;
  tokenSaverPct?: number;
  gateway?: string;
};

export function buildEngineList(preferred?: string): CascadeEngine[] {
  const engines: CascadeEngine[] = [
    {
      id: 'omniroute',
      url: 'omniroute',
      key: process.env.OMNIROUTE_BASE_URL || process.env.AI_GATEWAY_BASE_URL || undefined,
      model: process.env.OMNIROUTE_MODEL_CLAUDE || 'claude-sonnet-4-20250514',
      kind: 'omniroute',
    },
    {
      id: 'claude',
      url: 'https://api.anthropic.com/v1/messages',
      key: process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY,
      model: process.env.ANTHROPIC_MODEL || process.env.CLAUDE_MODEL || 'claude-sonnet-4-20250514',
      kind: 'anthropic',
    },
    {
      id: 'xai',
      url: 'https://api.x.ai/v1/chat/completions',
      key: process.env.XAI_API_KEY || process.env.XAI_GROK_PRESTIGE_API_KEY || process.env.GROK_API_KEY,
      model: process.env.XAI_MODEL || 'grok-2-1212',
      kind: 'openai',
    },
    {
      id: 'groq',
      url: 'https://api.groq.com/openai/v1/chat/completions',
      key: process.env.GROQ_API_KEY || process.env.GROQ_KEY,
      model: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile',
      kind: 'openai',
    },
    {
      id: 'groq-llama',
      url: 'https://api.groq.com/openai/v1/chat/completions',
      key: process.env.GROQ_API_KEY || process.env.GROQ_KEY,
      model: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile',
      kind: 'openai',
    },
    {
      id: 'openrouter',
      url: 'https://openrouter.ai/api/v1/chat/completions',
      key: process.env.OPENROUTER_API_KEY,
      model: process.env.OPENROUTER_MODEL || 'openai/gpt-oss-20b:free',
      kind: 'openai',
    },
  ];
  let list = engines.filter((e) => !!e.key);
  const pref = (preferred || 'claude').toLowerCase();
  const idx = list.findIndex((e) => e.id === pref || pref.includes(e.id) || e.id.includes(pref));
  if (idx > 0) {
    const [fav] = list.splice(idx, 1);
    list.unshift(fav);
  }
  return list;
}

export function isQuotaOrAuthError(msg: string) {
  const m = (msg || '').toLowerCase();
  return m.includes('quota') || m.includes('429') || m.includes('401') || m.includes('rate');
}

export async function runCascade(opts: CascadeCallOptions): Promise<CascadeResult> {
  const user =
    [...opts.messages].reverse().find((m) => m.role === 'user')?.content ||
    opts.messages.map((m) => m.content).join('\n');
  const history = opts.messages
    .filter((m) => m.role === 'user' || m.role === 'assistant')
    .slice(0, -1)
    .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }));

  let system = opts.system || '';
  if (opts.tribunalContext) {
    system += `\n\nCONTEXTO TRIBUNAL:\n${String(opts.tribunalContext).slice(0, 8000)}`;
  }

  const preferred = opts.preferred || opts.forceEngineId || 'claude';

  // OmniRoute
  const omni = process.env.OMNIROUTE_BASE_URL || process.env.AI_GATEWAY_BASE_URL || '';
  if (omni.trim() && (preferred.includes('claude') || preferred.includes('omni') || preferred === 'auto')) {
    try {
      const base = omni.replace(/\/$/, '').endsWith('/v1')
        ? omni.replace(/\/$/, '')
        : `${omni.replace(/\/$/, '')}/v1`;
      const key =
        process.env.OMNIROUTE_API_KEY ||
        process.env.ANTHROPIC_API_KEY ||
        process.env.OPENAI_API_KEY ||
        'omni';
      const msgs: Array<{ role: string; content: string }> = [];
      if (system) msgs.push({ role: 'system', content: system });
      for (const h of history) msgs.push(h);
      msgs.push({ role: 'user', content: user });
      const t0 = Date.now();
      const res = await fetch(`${base}/chat/completions`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${key}`,
        },
        body: JSON.stringify({
          model: process.env.OMNIROUTE_MODEL_CLAUDE || 'claude-sonnet-4-20250514',
          messages: msgs,
          max_tokens: opts.max_tokens ?? 4096,
          temperature: opts.temperature ?? 0.3,
        }),
        signal: AbortSignal.timeout(90000),
      });
      const raw = await res.json().catch(() => ({}));
      if (res.ok) {
        const text = (raw as any)?.choices?.[0]?.message?.content || '';
        if (text.trim()) {
          const latencyMs = Date.now() - t0;
          return {
            text: text.trim(),
            engineId: 'omniroute',
            model: (raw as any)?.model || 'claude',
            latencyMs,
            latency: latencyMs,
            tokens: (raw as any)?.usage?.total_tokens,
            gateway: base,
          };
        }
      }
    } catch {
      /* free gateway */
    }
  }

  const r = await freeComplete({ system, user, history });
  const parts = r.engine.split(':');
  return {
    text: r.text,
    engineId: parts[0] || r.engine,
    model: parts[1] || 'default',
    latencyMs: r.latencyMs,
    latency: r.latencyMs,
    tokens: 0,
  };
}

/** Overloads compatíveis com veredito / provider antigos */
export async function callOpenAICompatible(
  systemOrEngine: string | CascadeEngine | Record<string, unknown>,
  userOrMessages?: string | Array<{ role: string; content: string }>,
  preferredOrOpts?: string | { temperature?: number; max_tokens?: number },
  surface?: string
): Promise<CascadeResult> {
  // Forma A: callOpenAICompatible(system, user, preferred?)
  if (typeof systemOrEngine === 'string' && typeof userOrMessages === 'string') {
    const preferred =
      typeof preferredOrOpts === 'string' ? preferredOrOpts : undefined;
    return runCascade({
      preferred,
      system: systemOrEngine,
      messages: [{ role: 'user', content: userOrMessages }],
      surface,
      temperature:
        typeof preferredOrOpts === 'object' ? preferredOrOpts.temperature : undefined,
      max_tokens:
        typeof preferredOrOpts === 'object' ? preferredOrOpts.max_tokens : undefined,
    });
  }

  // Forma B: callOpenAICompatible(engine, messages[], opts)
  if (typeof systemOrEngine === 'object' && Array.isArray(userOrMessages)) {
    const eng = systemOrEngine as CascadeEngine;
    const msgs = userOrMessages as Array<{ role: string; content: string }>;
    const opts = (typeof preferredOrOpts === 'object' ? preferredOrOpts : {}) as {
      temperature?: number;
      max_tokens?: number;
    };
    const system = msgs.find((m) => m.role === 'system')?.content;
    const turns = msgs
      .filter((m) => m.role === 'user' || m.role === 'assistant')
      .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }));
    return runCascade({
      preferred: eng.id || 'claude',
      system,
      messages: turns.length ? turns : [{ role: 'user', content: '...' }],
      temperature: opts.temperature,
      max_tokens: opts.max_tokens,
      surface,
    });
  }

  // Forma C: só system+user via objeto malformado — fallback
  return runCascade({
    preferred: 'claude',
    system: typeof systemOrEngine === 'string' ? systemOrEngine : '',
    messages: [{ role: 'user', content: String(userOrMessages || '') }],
  });
}

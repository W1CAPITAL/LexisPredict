/**
 * Cascata Lexis — OmniRoute opcional; Free gateway sempre disponível.
 * Render Free + OmniRoute = abandonado. Vercel usa keys + Pollinations.
 */
import { freeComplete } from '@/lib/ai/free-gateway';

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
  tokensIn?: number;
  tokensOut?: number;
  tokenSaverPct?: number;
  gateway?: string;
};

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

  // OmniRoute se configurado (opcional)
  const omni =
    process.env.OMNIROUTE_BASE_URL ||
    process.env.AI_GATEWAY_BASE_URL ||
    '';
  if (omni.trim()) {
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
        }),
        signal: AbortSignal.timeout(90000),
      });
      const raw = await res.json().catch(() => ({}));
      if (res.ok) {
        const text = (raw as any)?.choices?.[0]?.message?.content || '';
        if (text.trim()) {
          return {
            text: text.trim(),
            engineId: 'omniroute',
            model: (raw as any)?.model || 'claude',
            latencyMs: Date.now() - t0,
            gateway: base,
          };
        }
      }
    } catch {
      /* cai no free gateway */
    }
  }

  const r = await freeComplete({ system, user, history });
  const [engineId, model] = r.engine.includes(':')
    ? (r.engine.split(':') as [string, string])
    : [r.engine, 'default'];
  return {
    text: r.text,
    engineId,
    model,
    latencyMs: r.latencyMs,
  };
}

export async function callOpenAICompatible(
  system: string,
  user: string,
  preferred?: string,
  surface?: string
) {
  const r = await runCascade({ preferred, system, messages: [{ role: 'user', content: user }], surface });
  return { text: r.text, engineId: r.engineId, model: r.model };
}

export function isQuotaOrAuthError(msg: string) {
  const m = (msg || '').toLowerCase();
  return m.includes('quota') || m.includes('429') || m.includes('401') || m.includes('rate');
}

export function buildEngineList() {
  return [];
}

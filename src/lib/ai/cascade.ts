/**
 * Cascata de provedores — nunca quebra o app por quota/token.
 * Ordem: preferred → xAI → Groq → OpenRouter (se key) → local determinístico.
 * Puter.js é client-side (ver puter-client.ts); no server usamos keys opcionais.
 */

export type CascadeEngine = {
  id: string;
  url: string;
  key?: string;
  model: string;
};

export function buildEngineList(preferred?: string): CascadeEngine[] {
  const engines: CascadeEngine[] = [
    {
      id: 'xai',
      url: 'https://api.x.ai/v1/chat/completions',
      key: process.env.XAI_API_KEY,
      model: process.env.XAI_MODEL || 'grok-2-1212',
    },
    {
      id: 'groq-llama',
      url: 'https://api.groq.com/openai/v1/chat/completions',
      key: process.env.GROQ_API_KEY,
      model: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile',
    },
    {
      id: 'openrouter',
      url: 'https://openrouter.ai/api/v1/chat/completions',
      key: process.env.OPENROUTER_API_KEY,
      model: process.env.OPENROUTER_MODEL || 'openai/gpt-oss-20b:free',
    },
    {
      id: 'airforce',
      url: 'https://api.airforce/v1/chat/completions',
      key: process.env.AIRFORCE_API_KEY,
      model: process.env.AIRFORCE_MODEL || 'deepseek-v3',
    },
  ];

  const list = engines.filter((e) => !!e.key);
  if (!preferred || preferred === 'local_only') return list;

  const idx = list.findIndex((e) => e.id === preferred || preferred.includes(e.id));
  if (idx > 0) {
    const [fav] = list.splice(idx, 1);
    list.unshift(fav);
  }
  return list;
}

export function isQuotaOrAuthError(msg: string): boolean {
  const m = (msg || '').toLowerCase();
  return (
    m.includes('quota') ||
    m.includes('rate limit') ||
    m.includes('429') ||
    m.includes('401') ||
    m.includes('403') ||
    m.includes('insufficient') ||
    m.includes('billing') ||
    m.includes('token') ||
    m.includes('credit') ||
    m.includes('payment') ||
    m.includes('exhausted')
  );
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function callOpenAICompatible(
  engine: CascadeEngine,
  messages: { role: string; content: string }[],
  opts?: { temperature?: number; max_tokens?: number; retries?: number }
): Promise<{ text: string; latency: number; tokens: number; engineId: string }> {
  const maxRetries = opts?.retries ?? 2;
  const cleanMessages = messages
    .map((m) => ({
      role: m.role === 'system' || m.role === 'assistant' || m.role === 'user' ? m.role : 'user',
      content: String(m.content || '').slice(0, 120000),
    }))
    .filter((m) => m.content.trim());

  let lastErr: any;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const start = Date.now();
    try {
      const headers: Record<string, string> = {
        Authorization: `Bearer ${engine.key}`,
        'Content-Type': 'application/json',
      };
      if (engine.id === 'openrouter') {
        headers['HTTP-Referer'] = process.env.NEXT_PUBLIC_APP_URL || 'https://lexispredict.app';
        headers['X-Title'] = 'LexisPredict';
      }

      const res = await fetch(engine.url, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model: engine.model,
          messages: cleanMessages,
          temperature: opts?.temperature ?? 0.55,
          max_tokens: opts?.max_tokens ?? 2048,
        }),
        signal: AbortSignal.timeout(35000),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        const msg = errorData?.error?.message || `HTTP ${res.status}`;
        throw new Error(msg);
      }

      const data = await res.json();
      const text = data?.choices?.[0]?.message?.content;
      if (!text) throw new Error('Resposta vazia');

      return {
        text: String(text),
        latency: Date.now() - start,
        tokens: data?.usage?.total_tokens || 0,
        engineId: engine.id,
      };
    } catch (e: any) {
      lastErr = e;
      if (attempt < maxRetries && !isQuotaOrAuthError(e?.message || '')) {
        await sleep(800 * attempt);
        continue;
      }
      throw e;
    }
  }
  throw lastErr || new Error('Falha no motor');
}

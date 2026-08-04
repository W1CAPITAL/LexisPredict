/**
 * Cascata neural Lexis — Claude (Anthropic Messages API) com capacidade completa.
 * Ordem: preferred → Claude → xAI → Groq → OpenRouter → Airforce → (local fora da lista).
 *
 * Claude: system, multi-turn, vision (base64), tools, temperature, top_p,
 * max_tokens, stop_sequences, metadata.
 */

export type CascadeEngine = {
  id: string;
  url: string;
  key?: string;
  model: string;
  kind: 'openai' | 'anthropic';
};

export type ChatTurn = {
  role: 'user' | 'assistant' | 'system';
  content: string;
};

export type VisionImage = {
  mediaType: 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp';
  /** base64 sem prefixo data: */
  data: string;
};

export type ClaudeTool = {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
};

export type CascadeCallOptions = {
  preferred?: string;
  system?: string;
  messages: ChatTurn[];
  /** imagens na última mensagem do usuário (Claude vision) */
  images?: VisionImage[];
  temperature?: number;
  top_p?: number;
  max_tokens?: number;
  stop_sequences?: string[];
  tools?: ClaudeTool[];
  /** forçar um único motor (sem cascata) */
  forceEngineId?: string;
};

export type CascadeResult = {
  text: string;
  engineId: string;
  model: string;
  latencyMs: number;
  tokensIn?: number;
  tokensOut?: number;
  stopReason?: string;
  raw?: unknown;
};

function anthropicKey(): string | undefined {
  return (
    process.env.ANTHROPIC_API_KEY ||
    process.env.CLAUDE_API_KEY ||
    process.env.ANTHROPIC_KEY ||
    undefined
  );
}

export function buildEngineList(preferred?: string): CascadeEngine[] {
  const engines: CascadeEngine[] = [
    {
      id: 'claude',
      url: 'https://api.anthropic.com/v1/messages',
      key: anthropicKey(),
      model:
        process.env.ANTHROPIC_MODEL ||
        process.env.CLAUDE_MODEL ||
        'claude-sonnet-4-20250514',
      kind: 'anthropic',
    },
    {
      id: 'xai',
      url: 'https://api.x.ai/v1/chat/completions',
      key:
        process.env.XAI_API_KEY ||
        process.env.XAI_GROK_PRESTIGE_API_KEY ||
        process.env.XAI_DOCUMENTS_API_KEY ||
        process.env.GROK_API_KEY,
      model: process.env.XAI_MODEL || 'grok-2-1212',
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
    {
      id: 'airforce',
      url: 'https://api.airforce/v1/chat/completions',
      key: process.env.AIRFORCE_API_KEY,
      model: process.env.AIRFORCE_MODEL || 'deepseek-v3',
      kind: 'openai',
    },
  ];

  let list = engines.filter((e) => !!e.key);
  const pref = (preferred || 'claude').toLowerCase().replace(/_official$/, '');
  if (!pref || pref === 'local_only' || pref === 'lexis_scripts') return list;

  const mapPref =
    pref.includes('claude') ? 'claude' :
    pref.includes('xai') || pref.includes('grok') ? 'xai' :
    pref.includes('groq') ? 'groq-llama' :
    pref.includes('openrouter') ? 'openrouter' :
    pref.includes('airforce') ? 'airforce' :
    pref;

  const idx = list.findIndex((e) => e.id === mapPref || e.id === pref);
  if (idx > 0) {
    const [fav] = list.splice(idx, 1);
    list.unshift(fav);
  }
  if (preferred?.startsWith('force:') || false) {
    /* reserved */
  }
  return list;
}

export function isQuotaOrAuthError(msg: string): boolean {
  const m = (msg || '').toLowerCase();
  return (
    m.includes('quota') ||
    m.includes('rate limit') ||
    m.includes('rate_limit') ||
    m.includes('429') ||
    m.includes('401') ||
    m.includes('403') ||
    m.includes('invalid api') ||
    m.includes('authentication') ||
    m.includes('unauthorized') ||
    m.includes('insufficient') ||
    m.includes('billing')
  );
}

function toAnthropicMessages(
  messages: ChatTurn[],
  images?: VisionImage[]
): Array<{ role: 'user' | 'assistant'; content: unknown }> {
  const out: Array<{ role: 'user' | 'assistant'; content: unknown }> = [];
  const filtered = messages.filter((m) => m.role === 'user' || m.role === 'assistant');
  filtered.forEach((m, i) => {
    const isLastUser =
      m.role === 'user' && i === filtered.length - 1 && images && images.length > 0;
    if (isLastUser) {
      const blocks: unknown[] = [];
      for (const img of images!) {
        blocks.push({
          type: 'image',
          source: {
            type: 'base64',
            media_type: img.mediaType,
            data: img.data.replace(/^data:[^;]+;base64,/, ''),
          },
        });
      }
      blocks.push({ type: 'text', text: m.content || '(imagem anexada)' });
      out.push({ role: 'user', content: blocks });
    } else {
      out.push({ role: m.role as 'user' | 'assistant', content: m.content });
    }
  });
  return out;
}

async function callAnthropic(
  engine: CascadeEngine,
  opts: CascadeCallOptions
): Promise<CascadeResult> {
  if (!engine.key) throw new Error('ANTHROPIC_API_KEY / CLAUDE_API_KEY ausente.');
  const t0 = Date.now();
  const body: Record<string, unknown> = {
    model: engine.model,
    max_tokens: opts.max_tokens ?? 4096,
    messages: toAnthropicMessages(opts.messages, opts.images),
  };
  if (opts.system) body.system = opts.system;
  if (typeof opts.temperature === 'number') body.temperature = opts.temperature;
  if (typeof opts.top_p === 'number') body.top_p = opts.top_p;
  if (opts.stop_sequences?.length) body.stop_sequences = opts.stop_sequences;
  if (opts.tools?.length) {
    body.tools = opts.tools;
    body.tool_choice = { type: 'auto' };
  }

  const res = await fetch(engine.url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': engine.key,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify(body),
  });
  const raw = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg =
      (raw as any)?.error?.message ||
      (raw as any)?.message ||
      `Anthropic HTTP ${res.status}`;
    throw new Error(msg);
  }
  const content = (raw as any)?.content;
  let text = '';
  if (Array.isArray(content)) {
    text = content
      .filter((b: any) => b?.type === 'text')
      .map((b: any) => b.text)
      .join('\n')
      .trim();
    // tool_use blocks → texto legível
    const tools = content.filter((b: any) => b?.type === 'tool_use');
    if (tools.length) {
      text +=
        (text ? '\n\n' : '') +
        tools
          .map(
            (t: any) =>
              `[tool:${t.name}] ${typeof t.input === 'string' ? t.input : JSON.stringify(t.input)}`
          )
          .join('\n');
    }
  }
  if (!text) throw new Error('Claude retornou conteúdo vazio.');
  return {
    text,
    engineId: engine.id,
    model: engine.model,
    latencyMs: Date.now() - t0,
    tokensIn: (raw as any)?.usage?.input_tokens,
    tokensOut: (raw as any)?.usage?.output_tokens,
    stopReason: (raw as any)?.stop_reason,
    raw,
  };
}

async function callOpenAICompat(
  engine: CascadeEngine,
  opts: CascadeCallOptions
): Promise<CascadeResult> {
  if (!engine.key) throw new Error(`Chave ausente para ${engine.id}`);
  const t0 = Date.now();
  const msgs: Array<{ role: string; content: string }> = [];
  if (opts.system) msgs.push({ role: 'system', content: opts.system });
  for (const m of opts.messages) {
    if (m.role === 'system') continue;
    msgs.push({ role: m.role, content: m.content });
  }
  const body: Record<string, unknown> = {
    model: engine.model,
    messages: msgs,
    max_tokens: opts.max_tokens ?? 4096,
  };
  if (typeof opts.temperature === 'number') body.temperature = opts.temperature;

  const headers: Record<string, string> = {
    'content-type': 'application/json',
    authorization: `Bearer ${engine.key}`,
  };
  if (engine.id === 'openrouter') {
    headers['HTTP-Referer'] = process.env.NEXT_PUBLIC_APP_URL || 'https://lexispredict.app';
    headers['X-Title'] = 'LexisPredict';
  }

  const res = await fetch(engine.url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
  const raw = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg =
      (raw as any)?.error?.message ||
      (raw as any)?.message ||
      `${engine.id} HTTP ${res.status}`;
    throw new Error(msg);
  }
  const text =
    (raw as any)?.choices?.[0]?.message?.content ||
    (raw as any)?.choices?.[0]?.text ||
    '';
  if (!String(text).trim()) throw new Error(`${engine.id} retornou vazio.`);
  return {
    text: String(text).trim(),
    engineId: engine.id,
    model: engine.model,
    latencyMs: Date.now() - t0,
    tokensIn: (raw as any)?.usage?.prompt_tokens,
    tokensOut: (raw as any)?.usage?.completion_tokens,
    raw,
  };
}

/** Executa cascata até o primeiro sucesso */
export async function runCascade(opts: CascadeCallOptions): Promise<CascadeResult> {
  let list = buildEngineList(opts.preferred);
  if (opts.forceEngineId) {
    list = list.filter((e) => e.id === opts.forceEngineId || opts.forceEngineId!.includes(e.id));
  }
  if (!list.length) {
    throw new Error(
      'Nenhum motor configurado. Defina ANTHROPIC_API_KEY (Claude) ou outra key no Vercel.'
    );
  }
  const errors: string[] = [];
  for (const engine of list) {
    try {
      if (engine.kind === 'anthropic') return await callAnthropic(engine, opts);
      return await callOpenAICompat(engine, opts);
    } catch (e: any) {
      const msg = e?.message || String(e);
      errors.push(`${engine.id}: ${msg}`);
      if (!isQuotaOrAuthError(msg) && list.length === 1) throw e;
      continue;
    }
  }
  throw new Error(`Todos os motores falharam. ${errors.slice(0, 4).join(' | ')}`);
}

/** Atalho chat simples */
export async function callOpenAICompatible(
  system: string,
  user: string,
  preferred?: string
): Promise<{ text: string; engineId: string; model: string }> {
  const r = await runCascade({
    preferred,
    system,
    messages: [{ role: 'user', content: user }],
  });
  return { text: r.text, engineId: r.engineId, model: r.model };
}

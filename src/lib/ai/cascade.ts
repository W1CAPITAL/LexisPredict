/**
 * Cascata de provedores — Claude (Anthropic) primeiro.
 * Ordem: preferred → Claude → xAI → Groq → OpenRouter → Airforce → local.
 * Respostas malformadas: erro explícito, sem lixo na UI.
 */

export type CascadeEngine = {
  id: string;
  url: string;
  key?: string;
  model: string;
  kind?: 'openai' | 'anthropic';
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
      key: process.env.XAI_API_KEY,
      model: process.env.XAI_MODEL || 'grok-2-1212',
      kind: 'openai',
    },
    {
      id: 'groq-llama',
      url: 'https://api.groq.com/openai/v1/chat/completions',
      key: process.env.GROQ_API_KEY,
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

  const list = engines.filter((e) => !!e.key);

  // Claude primeiro se preferido ou se for o default e estiver disponível
  const pref = (preferred || 'claude').toLowerCase();
  if (!pref || pref === 'local_only') return list;

  const idx = list.findIndex(
    (e) => e.id === pref || pref.includes(e.id) || e.id.includes(pref)
  );
  if (idx > 0) {
    const [fav] = list.splice(idx, 1);
    list.unshift(fav);
  } else if (idx === -1 && list[0]?.id !== 'claude') {
    // preferred não encontrado — mantém ordem (claude já é o 1º se tiver key)
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
    m.includes('credit') ||
    m.includes('payment') ||
    m.includes('exhausted') ||
    m.includes('invalid api key') ||
    m.includes('authentication')
  );
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function sanitizeMessages(messages: { role: string; content: string }[]) {
  return messages
    .map((m) => ({
      role:
        m.role === 'system' || m.role === 'assistant' || m.role === 'user'
          ? m.role
          : 'user',
      content: String((m as any).content ?? (m as any).conteudo ?? '').trim(),
    }))
    .filter((m) => m.content.length > 0);
}

/** Extrai texto útil; rejeita vazio / lixo */
export function extractCleanText(raw: unknown): { ok: true; text: string } | { ok: false; error: string } {
  if (raw == null) return { ok: false, error: 'Resposta vazia do motor.' };
  let text = typeof raw === 'string' ? raw : String(raw);
  text = text.replace(/\u0000/g, '').trim();
  if (!text) return { ok: false, error: 'Resposta vazia do motor.' };
  if (text.length < 2) return { ok: false, error: 'Resposta demasiado curta / inválida.' };
  // JSON quebrado óbvio sem conteúdo legível
  if (/^[\s\{\[\"]+$/.test(text)) {
    return { ok: false, error: 'Resposta malformada (só delimitadores).' };
  }
  return { ok: true, text };
}

async function callAnthropic(
  engine: CascadeEngine,
  messages: { role: string; content: string }[],
  opts?: { temperature?: number; max_tokens?: number }
): Promise<{ text: string; latency: number; tokens: number; engineId: string }> {
  if (!engine.key) throw new Error('ANTHROPIC_API_KEY / CLAUDE_API_KEY ausente.');

  const clean = sanitizeMessages(messages);
  const systemParts = clean.filter((m) => m.role === 'system').map((m) => m.content);
  const chatMsgs = clean
    .filter((m) => m.role !== 'system')
    .map((m) => ({
      role: m.role === 'assistant' ? 'assistant' : 'user',
      content: m.content,
    }));

  // Anthropic exige alternância user/assistant; funde user consecutivos se preciso
  const merged: { role: string; content: string }[] = [];
  for (const m of chatMsgs) {
    if (merged.length && merged[merged.length - 1].role === m.role) {
      merged[merged.length - 1].content += '\n\n' + m.content;
    } else {
      merged.push({ ...m });
    }
  }
  if (!merged.length) {
    merged.push({ role: 'user', content: 'Responda de forma objetiva em português.' });
  }
  if (merged[0].role !== 'user') {
    merged.unshift({ role: 'user', content: '(contexto)' });
  }

  const start = Date.now();
  const response = await fetch(engine.url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': engine.key,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: engine.model,
      max_tokens: opts?.max_tokens ?? 4096,
      temperature: opts?.temperature ?? 0.4,
      system: systemParts.length ? systemParts.join('\n\n') : undefined,
      messages: merged,
    }),
  });

  const latency = Date.now() - start;
  const body = await response.json().catch(() => ({}));

  if (!response.ok) {
    const msg =
      body?.error?.message ||
      body?.message ||
      `HTTP ${response.status} Claude`;
    throw new Error(msg);
  }

  // content blocks
  const blocks = Array.isArray(body?.content) ? body.content : [];
  const text = blocks
    .filter((b: any) => b?.type === 'text')
    .map((b: any) => b.text)
    .join('\n')
    .trim();

  const cleaned = extractCleanText(text);
  if (!cleaned.ok) throw new Error(cleaned.error + ' (Claude)');

  const tokens =
    (body?.usage?.input_tokens || 0) + (body?.usage?.output_tokens || 0);

  return {
    text: cleaned.text,
    latency,
    tokens,
    engineId: engine.id,
  };
}

export async function callOpenAICompatible(
  engine: CascadeEngine,
  messages: { role: string; content: string }[],
  opts?: { temperature?: number; max_tokens?: number; retries?: number }
): Promise<{ text: string; latency: number; tokens: number; engineId: string }> {
  if (engine.kind === 'anthropic' || engine.id === 'claude') {
    return callAnthropic(engine, messages, opts);
  }

  const maxRetries = opts?.retries ?? 2;
  const cleanMessages = sanitizeMessages(messages);
  let lastErr = 'Falha desconhecida';

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      if (!engine.key) throw new Error(`Key ausente: ${engine.id}`);

      const start = Date.now();
      const headers: Record<string, string> = {
        Authorization: `Bearer ${engine.key}`,
        'Content-Type': 'application/json',
      };
      if (engine.id === 'openrouter') {
        headers['HTTP-Referer'] = process.env.NEXT_PUBLIC_APP_URL || 'https://lexispredict.app';
        headers['X-Title'] = 'LexisPredict';
      }

      const response = await fetch(engine.url, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model: engine.model,
          messages: cleanMessages,
          temperature: opts?.temperature ?? 0.5,
          max_tokens: opts?.max_tokens ?? 4096,
        }),
      });

      const latency = Date.now() - start;
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        const msg =
          data?.error?.message || data?.message || `HTTP ${response.status}`;
        throw new Error(msg);
      }

      const raw =
        data?.choices?.[0]?.message?.content ??
        data?.choices?.[0]?.text ??
        '';
      const cleaned = extractCleanText(raw);
      if (!cleaned.ok) throw new Error(cleaned.error + ` (${engine.id})`);

      return {
        text: cleaned.text,
        latency,
        tokens: data?.usage?.total_tokens || 0,
        engineId: engine.id,
      };
    } catch (e: any) {
      lastErr = e?.message || String(e);
      if (attempt < maxRetries && isQuotaOrAuthError(lastErr) === false) {
        await sleep(500 * (attempt + 1));
        continue;
      }
      if (attempt < maxRetries && isQuotaOrAuthError(lastErr)) {
        break; // não insiste em auth/quota
      }
    }
  }
  throw new Error(lastErr);
}

/**
 * Tenta a cascata inteira. Retorna texto + motor ou erro legível.
 */
export async function runCascadeChat(
  messages: { role: string; content: string }[],
  preferred?: string,
  opts?: { temperature?: number; max_tokens?: number }
): Promise<
  | { success: true; text: string; engineId: string; latency: number; tokens: number }
  | { success: false; error: string; tried: string[] }
> {
  const list = buildEngineList(preferred);
  const tried: string[] = [];
  const errors: string[] = [];

  if (!list.length) {
    return {
      success: false,
      error:
        'Nenhum motor configurado. Defina ANTHROPIC_API_KEY (Claude) ou outra key no Vercel.',
      tried,
    };
  }

  for (const engine of list) {
    tried.push(engine.id);
    try {
      const r = await callOpenAICompatible(engine, messages, opts);
      return {
        success: true,
        text: r.text,
        engineId: r.engineId,
        latency: r.latency,
        tokens: r.tokens,
      };
    } catch (e: any) {
      errors.push(`${engine.id}: ${e?.message || e}`);
      continue;
    }
  }

  return {
    success: false,
    error: `Todos os motores falharam. ${errors.join(' | ')}`,
    tried,
  };
}

/**
 * Cascata Lexis — API estável para provider, veredito, chat, BA.
 * OmniRoute opcional; free gateway (Groq/Anthropic/OpenRouter/Pollinations).
 */
import { freeComplete } from '@/lib/ai/free-gateway';


/** Limpa URL colada no Vercel (=https://..., aspas, espaços) */
export function cleanGatewayBaseUrl(raw: string | undefined | null): string {
  if (!raw) return '';
  let s = String(raw).trim();
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    s = s.slice(1, -1).trim();
  }
  // erro clássico: colar "=https://..." no painel de env
  while (s.startsWith('=')) s = s.slice(1).trim();
  s = s.replace(/\s+/g, '');
  s = s.replace(/\/+$/, '');
  // se colaram já com /v1/chat/completions, corta
  const cut = s.indexOf('/chat/completions');
  if (cut > 0) s = s.slice(0, cut);
  if (s.endsWith('/v1')) {
    /* ok */
  } else if (s.includes('://')) {
    /* base host — add /v1 later */
  }
  return s;
}


/** Resposta inutil do gateway (emoji sozinho, pontuacao, modelo lixo tipo felo-chat) */
export function isLowQualityAiText(text: string, model?: string): boolean {
  const m = String(model || '').toLowerCase();
  if (m.includes('felo') || m.includes('pickle') || m.includes('nemotron-3-ultra-free')) {
    // modelos conhecidos por devolver lixo curto — so aceita se texto for substantivo
  }
  const t = String(text || '').trim();
  if (!t) return true;
  // so emoji / pontuacao / 1-2 chars
  const semEmoji = t.replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{200D}]/gu, '').trim();
  const soPontuacao = !/[a-zA-Z0-9\u00C0-\u024F]/.test(semEmoji);
  if (soPontuacao) return true;
  if (t.length <= 2) return true;
  if (/^[.?!,;…]+$/.test(t)) return true;
  if (/^(ok|sim|nao|não|\.+|\?+)$/i.test(t) && t.length < 4) return true;
  // cumprimentos: minimo de conteudo util (ex.: "Oi! Tudo bem?" passa)
  if (t.length < 8 && !/[a-zA-Z\u00C0-\u024F]{3,}/.test(t)) return true;
  return false;
}

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
      key: cleanGatewayBaseUrl(process.env.OMNIROUTE_BASE_URL || process.env.AI_GATEWAY_BASE_URL) || undefined,
      model: process.env.OMNIROUTE_MODEL || process.env.OMNIROUTE_MODEL_CLAUDE || 'auto/best-chat',
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
      key: process.env.XAI_GROK_PRESTIGE_API_KEY || process.env.XAI_API_KEY || process.env.GROK_API_KEY,
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
      id: 'nvidia',
      url: (() => {
        let b = (process.env.NVIDIA_BASE_URL || 'https://integrate.api.nvidia.com/v1').trim().replace(/\/+$/, '');
        while (b.startsWith('=')) b = b.slice(1).trim();
        if (!b.endsWith('/v1')) b = b + '/v1';
        return b + '/chat/completions';
      })(),
      key: process.env.NVIDIA_API_KEY || process.env.NVIDIA_NIM_API_KEY,
      model: process.env.NVIDIA_MODEL || process.env.NVIDIA_NIM_MODEL || 'meta/llama-3.3-70b-instruct',
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
  let list = engines.filter((e) => {
    if (e.id === 'omniroute') {
      return !!(
        process.env.OMNIROUTE_API_KEY ||
        process.env.OMNIROUTE_BASE_URL ||
        process.env.AI_GATEWAY_BASE_URL
      );
    }
    return !!e.key;
  });
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

  const exclusive = !!(opts.forceEngineId || (opts.preferred && opts.preferred !== 'auto'));
  // omni = cascata completa (não é motor exclusivo)
  let preferred = (opts.forceEngineId || opts.preferred || 'auto').toLowerCase();
  if (preferred === 'omni' || preferred === 'omniroute' || preferred === 'cascade') {
    preferred = 'auto';
  }
  const errors: string[] = [];

  // --- MiniMax (principal na cascata Omni) ---
  const wantMinimax =
    preferred === 'minimax' ||
    preferred.includes('minimax') ||
    preferred === 'auto';
  if (wantMinimax) {
    try {
      const { isMinimaxConfigured, callMinimax } = await import('@/lib/ai/minimax');
      if (isMinimaxConfigured()) {
        const msgs: Array<{ role: string; content: string }> = [];
        if (system) msgs.push({ role: 'system', content: system });
        for (const h of history) msgs.push(h);
        msgs.push({ role: 'user', content: String(user) });
        const r = await callMinimax(msgs, {
          max_tokens: opts.max_tokens ?? 4096,
          temperature: opts.temperature ?? 0.4,
        });
        if (r.text.trim()) {
          return {
            text: r.text,
            engineId: 'minimax',
            model: r.model,
            latencyMs: r.latencyMs,
            latency: r.latencyMs,
            tokens: 0,
          };
        }
      }
    } catch (e: any) {
      errors.push(`minimax: ${e?.message || e}`);
      // continua cascata
    }
  }

  // --- NVIDIA NIM (OpenAI-compatible Integrate API) ---
  const wantNvidia =
    preferred === 'nvidia' ||
    preferred.includes('nvidia') ||
    preferred.includes('nim') ||
    preferred.includes('inkling');
  if (wantNvidia || preferred === 'auto') {
    try {
      const { isNvidiaConfigured, callNvidiaNim } = await import('@/lib/ai/nvidia-nim');
      if (isNvidiaConfigured()) {
        const msgs: Array<{ role: string; content: string }> = [];
        if (system) msgs.push({ role: 'system', content: system });
        for (const h of history) msgs.push(h);
        msgs.push({ role: 'user', content: String(user) });
        const r = await callNvidiaNim(msgs, {
          max_tokens: opts.max_tokens ?? 4096,
          temperature: opts.temperature ?? 0.7,
        });
        if (r.text.trim()) {
          return {
            text: r.text,
            engineId: 'nvidia',
            model: r.model,
            latencyMs: r.latencyMs,
            latency: r.latencyMs,
            tokens: r.tokens,
          };
        }
      }
    } catch (e: any) {
      errors.push(`nvidia-nim: ${e?.message || e}`);
      if (exclusive && wantNvidia) {
        return { text: '', engineId: 'nvidia', model: '', latencyMs: 0, error: String(e?.message || e) } as any;
      }
    }
  }

  // --- xAI Prestige direto (quando preferred = xai/grok) ---
  const wantXai =
    preferred === 'xai' ||
    preferred.includes('grok') ||
    preferred.includes('prestige');
  if (wantXai || preferred === 'auto') {
    try {
      const { isXaiConfigured, callXaiPrestige } = await import('@/lib/ai/xai-prestige');
      if (isXaiConfigured()) {
        const msgs: Array<{ role: string; content: string }> = [];
        if (system) msgs.push({ role: 'system', content: system });
        for (const h of history) msgs.push(h);
        msgs.push({ role: 'user', content: String(user) });
        const r = await callXaiPrestige(msgs, {
          max_tokens: opts.max_tokens ?? 4096,
          temperature: opts.temperature ?? 0.4,
        });
        if (r.text.trim()) {
          return {
            text: r.text,
            engineId: 'xai',
            model: r.model,
            latencyMs: r.latencyMs,
            latency: r.latencyMs,
            tokens: r.tokens,
          };
        }
      }
    } catch (e: any) {
      errors.push(`xai-prestige: ${e?.message || e}`);
      if (wantXai && preferred !== 'auto') {
        // continua para freeComplete fallback
      }
    }
  }

  // --- Anthropic direto (quando Claude e a preferencia e ha API key) ---
  const anthropicKey =
    process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY || process.env.ANTHROPIC_KEY;
  const wantClaudeDirect =
    !!anthropicKey &&
    (preferred === 'claude' ||
      preferred.includes('anthropic') ||
      preferred === 'auto');
  if (wantClaudeDirect) {
    try {
      const { freeComplete } = await import('@/lib/ai/free-gateway');
      // usa so anthropic via exclusive path interno — callAnthropic
      const sys = system || '';
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': anthropicKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model:
            process.env.ANTHROPIC_MODEL ||
            process.env.CLAUDE_MODEL ||
            'claude-sonnet-4-20250514',
          max_tokens: opts.max_tokens ?? 4096,
          temperature: opts.temperature ?? 0.4,
          system: sys || undefined,
          messages: [
            ...history.map((h) => ({ role: h.role, content: h.content })),
            {
              role: 'user',
              content: opts.images?.length
                ? // vision: so texto aqui; imagem fica no omni se necessario
                  String(user)
                : String(user),
            },
          ],
        }),
        signal: AbortSignal.timeout(90000),
      });
      const raw = await res.json().catch(() => ({}));
      if (res.ok) {
        const text = Array.isArray((raw as any)?.content)
          ? (raw as any).content
              .filter((b: any) => b.type === 'text')
              .map((b: any) => b.text)
              .join('\n')
          : '';
        if (text.trim() && !isLowQualityAiText(text.trim())) {
          return {
            text: text.trim(),
            engineId: 'claude',
            model:
              process.env.ANTHROPIC_MODEL ||
              process.env.CLAUDE_MODEL ||
              'claude-sonnet-4-20250514',
            latencyMs: 0,
            latency: 0,
            tokens: (raw as any)?.usage?.input_tokens
              ? (raw as any).usage.input_tokens + ((raw as any).usage.output_tokens || 0)
              : undefined,
          };
        }
      } else {
        errors.push(
          `anthropic-direct: ${(raw as any)?.error?.message || res.status}`
        );
      }
    } catch (e: any) {
      errors.push(`anthropic-direct: ${e?.message || e}`);
    }
  }

  // --- OmniRoute (só se preferred for omni/claude/auto) ---
  const omni = cleanGatewayBaseUrl(process.env.OMNIROUTE_BASE_URL || process.env.AI_GATEWAY_BASE_URL || '');
  const wantOmni =
    preferred === 'auto' ||
    preferred.includes('omni') ||
    preferred === 'claude' ||
    preferred.includes('anthropic');

  if (omni.trim() && wantOmni) {
    try {
      const cleaned = cleanGatewayBaseUrl(omni);
      if (!cleaned.startsWith('http')) {
        throw new Error(`OMNIROUTE_BASE_URL inválida: "${String(omni).slice(0, 40)}"`);
      }
      const base = cleaned.endsWith('/v1') ? cleaned : `${cleaned}/v1`;
      const key =
        process.env.OMNIROUTE_API_KEY ||
        process.env.ANTHROPIC_API_KEY ||
        process.env.OPENAI_API_KEY ||
        'omni';
      const msgs: Array<{ role: string; content: string }> = [];
      if (system) msgs.push({ role: 'system', content: system });
      for (const h of history) msgs.push(h);
      msgs.push({ role: 'user', content: user });

      // Modelos: NÃO use claude-sonnet-4-* se Anthropic não estiver cadastrado no painel OmniRoute
      // (isso gera HTTP 404 "No active credentials for provider: anthropic").
      // Preferir modelos uteis; evitar auto/best-free que roteia para felo-chat / lixo
      const modelCandidates = [
        process.env.OMNIROUTE_MODEL_CLAUDE,
        process.env.OMNIROUTE_MODEL,
        process.env.ANTHROPIC_MODEL,
        'claude-sonnet-4-20250514',
        'claude-3-5-sonnet-latest',
        'anthropic/claude-sonnet-4',
        'auto/best-chat',
        'gpt-4o-mini',
        'auto',
      ].filter((v, i, a) => !!v && a.indexOf(v) === i) as string[];

      const t0 = Date.now();
      let lastStatus = 0;
      let lastBody: any = {};

      for (const model of modelCandidates) {
        const res = await fetch(`${base}/chat/completions`, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            authorization: `Bearer ${key}`,
            accept: 'application/json',
          },
          body: JSON.stringify({
            model,
            messages: msgs,
            max_tokens: opts.max_tokens ?? 4096,
            temperature: opts.temperature ?? 0.3,
            stream: false,
          }),
          signal: AbortSignal.timeout(90000),
        });
        lastStatus = res.status;
        const ct = res.headers.get('content-type') || '';
        const rawText = await res.text();
        let raw: any = {};
        try {
          raw = JSON.parse(rawText);
        } catch {
          // SSE / stream acidental
          if (rawText.includes('data:')) {
            const parts = rawText
              .split('\n')
              .filter((l) => l.startsWith('data:'))
              .map((l) => l.replace(/^data:\s*/, '').trim())
              .filter((l) => l && l !== '[DONE]');
            let acc = '';
            for (const p of parts) {
              try {
                const j = JSON.parse(p);
                acc += j?.choices?.[0]?.delta?.content || j?.choices?.[0]?.message?.content || '';
              } catch {
                /* */
              }
            }
            if (acc.trim()) {
              const latencyMs = Date.now() - t0;
              return {
                text: acc.trim(),
                engineId: 'omniroute',
                model,
                latencyMs,
                latency: latencyMs,
                tokens: 0,
                gateway: base,
              };
            }
          }
          raw = { error: { message: rawText.slice(0, 200) } };
        }
        lastBody = raw;

        if (res.ok) {
          const text =
            raw?.choices?.[0]?.message?.content ||
            raw?.choices?.[0]?.text ||
            '';
          const resolvedModel = String(raw?.model || model || '');
          const trimmed = String(text).trim();
          // Rejeita felo-chat e respostas vazias/emoji
          if (
            /felo/i.test(resolvedModel) ||
            isLowQualityAiText(trimmed, resolvedModel)
          ) {
            errors.push(
              `omniroute[${resolvedModel}]: resposta baixa qualidade (${trimmed.slice(0, 40) || 'vazio'})`
            );
            continue;
          }
          if (trimmed) {
            const latencyMs = Date.now() - t0;
            return {
              text: trimmed,
              engineId: 'omniroute',
              model: resolvedModel,
              latencyMs,
              latency: latencyMs,
              tokens: raw?.usage?.total_tokens,
              gateway: base,
            };
          }
        }

        // 404/402 neste modelo → tenta próximo; não aborta a cascata inteira
        const msg = raw?.error?.message || `HTTP ${res.status}`;
        errors.push(`omniroute[${model}]: ${msg}`);
        if (res.status === 401 || res.status === 403) break;
      }

      if (lastStatus && !errors.length) {
        errors.push(`omniroute: HTTP ${lastStatus}`);
      }
    } catch (e: any) {
      errors.push(`omniroute: ${e?.message || e}`);
    }
    // NÃO bloquear fallback por "modo exclusivo" no OmniRoute:
    // se o gateway falhou (404 credenciais Anthropic, 402, etc.), segue para xAI/Groq/etc.
    // Só encerra se forceEngineId for estritamente omniroute E não houver lista depois.
  }

  // --- Lista de engines filtrada: se exclusive, só o id pedido ---
  let list = buildEngineList(preferred === 'auto' ? undefined : preferred);
  // Claude/omni preferidos: ainda permitem fallback se o gateway falhou
  const allowFallback =
    preferred === 'auto' ||
    preferred.includes('claude') ||
    preferred.includes('omni') ||
    preferred.includes('anthropic') ||
    !exclusive;
  if (exclusive && !allowFallback && preferred !== 'auto') {
    list = list.filter(
      (e) =>
        e.id === preferred ||
        preferred.includes(e.id) ||
        e.id.includes(preferred.replace('groq:llama', 'groq'))
    );
    if (list.length === 0) {
      // tenta match parcial
      list = buildEngineList().filter(
        (e) => preferred.includes(e.id) || e.id.includes(preferred.split(':')[0])
      );
    }
  }

  const { freeComplete } = await import('@/lib/ai/free-gateway');
  // Claude/Omni preferidos: SEMPRE cascateiam para o próximo motor se falharem (quota/token)
  const softExclusive =
    exclusive &&
    !(
      preferred === 'auto' ||
      preferred.includes('claude') ||
      preferred.includes('omni') ||
      preferred.includes('anthropic') ||
      preferred.includes('relatorio')
    );
  try {
    const r = await freeComplete({
      system,
      user,
      history,
      preferred: preferred === 'auto' ? undefined : preferred,
      exclusive: softExclusive,
    } as any);
    const parts = r.engine.split(':');
    return {
      text: r.text,
      engineId: parts[0] || r.engine,
      model: parts[1] || 'default',
      latencyMs: r.latencyMs,
      latency: r.latencyMs,
      tokens: 0,
    };
  } catch (e: any) {
    errors.push(e?.message || String(e));
    throw new Error(
      `Nenhum motor disponível para "${preferred}". ${errors.join(' | ')}`
    );
  }
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

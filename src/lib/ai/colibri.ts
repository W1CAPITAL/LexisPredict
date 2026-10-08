/**
 * Bridge de inferência Colibri externa (API OpenAI-compatible).
 * O modelo e o servidor precisam estar instalados e rodando FORA da Vercel.
 * Não armazena segredos no browser e não envia dados a provedores externos
 * quando o usuário exige explicitamente 'colibri'.
 */
import type { ChatTurn } from './cascade';

export function colibriConfig(env: Record<string, string | undefined> = process.env) {
  const raw = String(env.COLIBRI_BASE_URL || '').trim().replace(/^=/, '').replace(/^["']|["']$/g, '');
  if (!raw) return null;
  let url: URL;
  try { url = new URL(raw); } catch { return null; }
  if (url.protocol !== 'https:' && !(env.NODE_ENV !== 'production' && url.protocol === 'http:')) return null;
  if (url.username || url.password || url.search || url.hash) return null;
  const path = url.pathname.replace(/\/+$/, '');
  if (!path.endsWith('/chat/completions')) {
    url.pathname = path.endsWith('/v1') ? path + '/chat/completions' : path + '/v1/chat/completions';
  }
  const time = Number(env.COLIBRI_TIMEOUT_MS || 35000);
  return {
    endpoint: url.toString(),
    model: String(env.COLIBRI_MODEL || 'auto').trim() || 'auto',
    key: String(env.COLIBRI_API_KEY || '').trim(),
    timeoutMs: Number.isFinite(time) ? Math.max(3000, Math.min(100000, time)) : 35000,
  };
}

type Config = NonNullable<ReturnType<typeof colibriConfig>>;
const modelCache = new Map<string, { model: string; expires: number }>();
const modelEndpoint = (endpoint: string) => endpoint.replace(/\/chat\/completions\/?$/, '/models');

function authHeaders(cfg: Config): Record<string, string> {
  return cfg.key ? { Authorization: 'Bearer ' + cfg.key } : {};
}

/** Consulta o modelo efetivamente carregado, em vez de enviar model='auto',
 * que não corresponde a um ID válido em várias versões do servidor Colibri. */
export async function discoverColibriModel(cfg: Config): Promise<string> {
  if (cfg.model !== 'auto') return cfg.model;
  const cached = modelCache.get(cfg.endpoint);
  if (cached && cached.expires > Date.now()) return cached.model;

  const response = await fetch(modelEndpoint(cfg.endpoint), {
    method: 'GET',
    headers: authHeaders(cfg),
    cache: 'no-store',
    signal: AbortSignal.timeout(Math.min(4000, cfg.timeoutMs)),
  });
  if (!response.ok) throw new Error('Colibri /v1/models HTTP ' + response.status);
  const data = await response.json().catch(() => null);
  const model = String(data?.data?.find?.((m: any) => typeof m?.id === 'string')?.id || '').trim();
  if (!model) throw new Error('Colibri sem modelo carregado em /v1/models');
  modelCache.set(cfg.endpoint, { model, expires: Date.now() + 60000 });
  return model;
}

export async function probeColibri() {
  const cfg = colibriConfig();
  if (!cfg) return { configured: false, reachable: false, model: null, reason: 'COLIBRI_BASE_URL ausente ou inválida (HTTPS obrigatório em produção)' };
  try {
    const model = await discoverColibriModel(cfg);
    return { configured: true, reachable: true, model, reason: null };
  } catch {
    return { configured: true, reachable: false, model: null, reason: 'Servidor Colibri inacessível ou sem modelo ativo' };
  }
}

export async function callColibri(messages: ChatTurn[], options: { maxTokens?: number; temperature?: number } = {}) {
  const cfg = colibriConfig();
  if (!cfg) throw new Error('COLIBRI_BASE_URL não configurada para um servidor HTTPS de inferência');
  const started = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), cfg.timeoutMs);
  try {
    const model = await discoverColibriModel(cfg);
    const response = await fetch(cfg.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders(cfg),
      },
      body: JSON.stringify({
        model,
        messages: messages.slice(-12).map(m => ({ role: m.role, content: String(m.content).slice(0, 12000) })),
        temperature: Math.max(0, Math.min(1, options.temperature ?? 0.3)),
        max_tokens: Math.max(32, Math.min(2048, options.maxTokens ?? 512)),
        stream: false,
      }),
      cache: 'no-store',
      signal: controller.signal,
    });
    if (!response.ok) throw new Error('Colibri HTTP ' + response.status);
    const data = await response.json().catch(() => null);
    const content = data?.choices?.[0]?.message?.content;
    const text = typeof content === 'string' ? content :
      Array.isArray(content) ? content.filter((x: any) => x?.type === 'text').map((x: any) => String(x.text || '')).join('\n') : '';
    if (!text.trim()) throw new Error('Colibri retornou resposta vazia');
    return { text: text.trim(), model: String(data?.model || model), latencyMs: Date.now() - started };
  } finally {
    clearTimeout(timer);
  }
}

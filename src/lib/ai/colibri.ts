
/** Opt-in self-hosted Colibri HTTP bridge (JustVugg/colibri, Apache-2.0).
 * Requires an independently hosted, secured Colibri service; Vercel cannot run
 * the multi-GB native model in a serverless function. */
import type { ChatTurn } from './cascade';

export function colibriConfig(env: Record<string, string | undefined> = process.env) {
  const raw = String(env.COLIBRI_BASE_URL || '').trim().replace(/^=/, '').replace(/^["']|["']$/g, '');
  if (!raw) return null;
  let url: URL;
  try { url = new URL(raw); } catch { return null; }
  if (url.protocol !== 'https:' && !(env.NODE_ENV !== 'production' && url.protocol === 'http:')) return null;
  if (url.username || url.password || url.search || url.hash) return null;
  const path = url.pathname.replace(/\/+$/, '');
  if (!path.endsWith('/chat/completions')) url.pathname = path.endsWith('/v1') ? path + '/chat/completions' : path + '/v1/chat/completions';
  const time = Number(env.COLIBRI_TIMEOUT_MS || 35000);
  return {
    endpoint: url.toString(),
    model: String(env.COLIBRI_MODEL || 'auto').trim() || 'auto',
    key: String(env.COLIBRI_API_KEY || '').trim(),
    timeoutMs: Number.isFinite(time) ? Math.max(3000, Math.min(100000, time)) : 35000,
  };
}

export async function callColibri(messages: ChatTurn[], options: { maxTokens?: number; temperature?: number } = {}) {
  const cfg = colibriConfig();
  if (!cfg) throw new Error('COLIBRI_BASE_URL não configurada para um servidor HTTPS de inferência');
  const started = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), cfg.timeoutMs);
  try {
    const response = await fetch(cfg.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(cfg.key ? { Authorization: 'Bearer ' + cfg.key } : {}),
      },
      body: JSON.stringify({
        model: cfg.model,
        messages: messages.slice(-14).map(m => ({ role: m.role, content: String(m.content).slice(0, 24000) })),
        temperature: Math.max(0, Math.min(1, options.temperature ?? 0.3)),
        max_tokens: Math.max(32, Math.min(4096, options.maxTokens ?? 2048)),
        stream: false,
      }),
      cache: 'no-store',
      signal: controller.signal,
    });
    if (!response.ok) throw new Error('Colibri HTTP ' + response.status);
    const data = await response.json().catch(() => null);
    const text = data?.choices?.[0]?.message?.content;
    if (typeof text !== 'string' || !text.trim()) throw new Error('Colibri retornou resposta vazia');
    return { text: text.trim(), model: String(data?.model || cfg.model), latencyMs: Date.now() - started };
  } finally {
    clearTimeout(timer);
  }
}

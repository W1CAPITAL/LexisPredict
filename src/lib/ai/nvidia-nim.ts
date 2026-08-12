/**
 * NVIDIA NIM / Integrate API (OpenAI-compatible)
 * Env (NUNCA hardcode key no repo):
 *   NVIDIA_API_KEY
 *   NVIDIA_BASE_URL  (default https://integrate.api.nvidia.com/v1)
 *   NVIDIA_MODEL     (default meta/llama-3.3-70b-instruct — ou o modelo liberado na sua conta)
 *
 * O modelo "thinkingmachines/inkling" só funciona se estiver habilitado no seu projeto NVIDIA.
 */

export function isNvidiaConfigured(): boolean {
  return !!(process.env.NVIDIA_API_KEY || process.env.NVIDIA_NIM_API_KEY);
}

export function nvidiaBaseUrl(): string {
  let s = (process.env.NVIDIA_BASE_URL || 'https://integrate.api.nvidia.com/v1').trim();
  while (s.startsWith('=')) s = s.slice(1).trim();
  s = s.replace(/\/+$/, '');
  if (s.endsWith('/chat/completions')) s = s.replace(/\/chat\/completions$/, '');
  return s;
}

export function nvidiaModel(): string {
  return (
    process.env.NVIDIA_MODEL ||
    process.env.NVIDIA_NIM_MODEL ||
    'meta/llama-3.3-70b-instruct'
  );
}

export async function callNvidiaNim(
  messages: Array<{ role: string; content: string }>,
  opts?: { temperature?: number; max_tokens?: number; model?: string }
): Promise<{ text: string; model: string; latencyMs: number; tokens?: number }> {
  const key = process.env.NVIDIA_API_KEY || process.env.NVIDIA_NIM_API_KEY;
  if (!key) throw new Error('NVIDIA_API_KEY ausente');

  const base = nvidiaBaseUrl();
  const model = opts?.model || nvidiaModel();
  const url = base.endsWith('/v1')
    ? `${base}/chat/completions`
    : `${base}/v1/chat/completions`;

  const t0 = Date.now();
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: opts?.temperature ?? 0.7,
      top_p: 0.95,
      max_tokens: opts?.max_tokens ?? 4096,
      stream: false,
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`NVIDIA HTTP ${res.status}: ${errText.slice(0, 240)}`);
  }

  const data = await res.json();
  const text = data?.choices?.[0]?.message?.content || '';
  const tokens = data?.usage?.total_tokens;
  return { text: String(text), model, latencyMs: Date.now() - t0, tokens };
}

/**
 * Cliente Ornith — OpenAI-compatible /v1/chat/completions, chamada única.
 * Padrão: Ollama local (http://localhost:11434/v1) com o GGUF oficial
 * deepreinforce-ai/Ornith-1.5-9B-GGUF — mas qualquer endpoint OpenAI-compatível
 * funciona via ORNITH_BASE_URL / ORNITH_MODEL / ORNITH_API_KEY.
 */

export function ornithConfigFromEnv(env = process.env) {
  return {
    baseUrl: (env.ORNITH_BASE_URL || "http://localhost:11434/v1").replace(/\/+$/, ""),
    model: env.ORNITH_MODEL || "hf.co/deepreinforce-ai/Ornith-1.5-9B-GGUF",
    apiKey: env.ORNITH_API_KEY || "EMPTY",
    timeoutMs: Number(env.ORNITH_TIMEOUT_MS) || 180_000,
  };
}

/**
 * Uma chamada de chat. Retorna { ok, conteudo, erro? }. Nunca lança.
 * Temperatura/top_p seguem a recomendação do README do Ornith para código.
 */
export async function ornithChat(config, { system, user, maxTokens = 4096 }) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.timeoutMs);
  try {
    const res = await fetch(`${config.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model: config.model,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        temperature: 0.6,
        top_p: 0.95,
        max_tokens: maxTokens,
      }),
      signal: controller.signal,
    });
    if (!res.ok) {
      const corpo = (await res.text().catch(() => "")).slice(0, 300);
      return { ok: false, erro: `Ornith HTTP ${res.status}: ${corpo || "(sem corpo)"}` };
    }
    const data = await res.json();
    const msg = data?.choices?.[0]?.message;
    const conteudo = String(msg?.content || "");
    if (!conteudo.trim()) return { ok: false, erro: "Ornith respondeu vazio" };
    return { ok: true, conteudo };
  } catch (e) {
    const motivo =
      e?.name === "AbortError"
        ? `timeout após ${Math.round(config.timeoutMs / 1000)}s`
        : e?.message || "falha de rede";
    return {
      ok: false,
      erro: `Ornith inacessível (${motivo}). Suba o modelo: ollama run hf.co/deepreinforce-ai/Ornith-1.5-9B-GGUF`,
    };
  } finally {
    clearTimeout(timer);
  }
}

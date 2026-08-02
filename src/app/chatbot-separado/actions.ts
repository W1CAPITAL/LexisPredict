"use server";

/**
 * Chat com fallback: tenta xAI (vários modelos) → Groq se falhar.
 */

const XAI_MODELS = [
  process.env.XAI_MODEL,
  'grok-2-latest',
  'grok-3-latest',
  'grok-2',
  'grok-beta',
].filter(Boolean) as string[];

async function callXAI(messages: any[]): Promise<{ ok: true; text: string; model: string } | { ok: false; error: string }> {
  const apiKey = process.env.XAI_API_KEY || process.env.GROK_API_KEY;
  if (!apiKey) return { ok: false, error: 'XAI_API_KEY ausente no servidor (Vercel env).' };

  let lastErr = 'xAI sem resposta';
  for (const modelName of XAI_MODELS) {
    try {
      const response = await fetch('https://api.x.ai/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: modelName,
          messages,
          temperature: 0.5,
          max_tokens: 2048,
        }),
        signal: AbortSignal.timeout(28000),
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        lastErr = err?.error?.message || `xAI HTTP ${response.status} (${modelName})`;
        continue;
      }
      const data = await response.json();
      const text = data.choices?.[0]?.message?.content;
      if (text) return { ok: true, text, model: modelName };
      lastErr = `Resposta vazia (${modelName})`;
    } catch (e: any) {
      lastErr = e?.message || String(e);
    }
  }
  return { ok: false, error: lastErr };
}

async function callGroq(messages: any[]): Promise<{ ok: true; text: string; model: string } | { ok: false; error: string }> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return { ok: false, error: 'GROQ_API_KEY ausente.' };
  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages,
        temperature: 0.5,
        max_tokens: 2048,
      }),
      signal: AbortSignal.timeout(28000),
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      return { ok: false, error: err?.error?.message || `Groq HTTP ${response.status}` };
    }
    const data = await response.json();
    const text = data.choices?.[0]?.message?.content;
    if (!text) return { ok: false, error: 'Groq resposta vazia' };
    return { ok: true, text, model: 'llama-3.3-70b-versatile' };
  } catch (e: any) {
    return { ok: false, error: e?.message || 'Groq falhou' };
  }
}

export async function perguntarChatbotIndependente(
  prompt: string,
  history: any[],
  model: string
) {
  const system = `Você é assistente operacional de equipe jurídica/financeira no Brasil.
- Português claro. Não invente andamentos de processo.
- Não cite marca/empresa em textos para cliente.
- Se faltar CNJ, peça o número. Priorize fatos da carteira/tribunal.`;

  const messages = [
    { role: 'system', content: system },
    ...history.slice(-8).map((m) => ({
      role: m.role === 'assistant' ? 'assistant' : 'user',
      content: m.content,
    })),
    { role: 'user', content: prompt },
  ];

  const preferXai = model === 'xai' || model === 'grok';

  if (preferXai) {
    const xai = await callXAI(messages);
    if (xai.ok) {
      return { sucesso: true, resposta: xai.text, engine: `XAI:${xai.model}` };
    }
    // fallback automático Groq
    const groq = await callGroq(messages);
    if (groq.ok) {
      return {
        sucesso: true,
        resposta: groq.text,
        engine: `GROQ(fallback):${groq.model}`,
        aviso: `xAI falhou (${xai.error}). Usando Groq.`,
      };
    }
    return {
      sucesso: false,
      resposta: `xAI: ${xai.error}. Groq: ${groq.error}. Configure XAI_API_KEY / GROQ_API_KEY e XAI_MODEL na Vercel.`,
    };
  }

  const groq = await callGroq(messages);
  if (groq.ok) return { sucesso: true, resposta: groq.text, engine: `GROQ:${groq.model}` };

  const xai = await callXAI(messages);
  if (xai.ok) {
    return {
      sucesso: true,
      resposta: xai.text,
      engine: `XAI(fallback):${xai.model}`,
      aviso: `Groq falhou. Usando xAI.`,
    };
  }

  return {
    sucesso: false,
    resposta: `Groq: ${groq.error}. xAI: ${xai.error}.`,
  };
}

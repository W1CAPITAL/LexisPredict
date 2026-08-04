/**
 * Unidade Neural — lê TODAS as chaves possíveis do Vercel.
 * Antes só lia XAI_API_KEY; no projeto existe XAI_GROK_PRESTIGE_API_KEY → "motores em recalibração".
 * @copyright 2026 Davi Alves Figueredo / W1 Capital Assessoria Financeira Ltda.
 */
'use server';

import { ai, z } from '@/ai/genkit';

function resolveXaiKey(): string | undefined {
  return (
    process.env.XAI_API_KEY ||
    process.env.XAI_GROK_PRESTIGE_API_KEY ||
    process.env.XAI_DOCUMENTS_API_KEY ||
    process.env.GROK_API_KEY ||
    undefined
  );
}

function resolveGroqKey(): string | undefined {
  return process.env.GROQ_API_KEY || process.env.GROQ_KEY || undefined;
}

const SYSTEM_PROMPT = `Você é o Consultor Estratégico Sênior do Gabinete Jurídico.
Sua missão é triar informações do tribunal e redigir mensagens profissionais para clientes leigos.

REGRAS DE OURO:
1. Analise movimentos e publicações; explique de forma clara, sem inventar valores.
2. R$ de renda/salário/cônjuge NÃO é custas. Custas só se o texto for taxa/guia/UFESP/DARE.
3. Se a intimação for à parte requerida/réu/banco, o cliente NÃO paga.
4. AJG do autor = em regra isento de custas.
5. Cancelamento da distribuição (art. 290) = processo baixado; não invente dívida.
6. Cumprimento de sentença / intimação ao executado = boa notícia para o autor.
7. Nunca cite nome de escritório/marca; use "nossa equipe".
8. Não diga "não precisa fazer nada" se houver prazo real para o autor se manifestar.`;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function callEngineWithRetry(
  url: string,
  key: string | undefined,
  model: string,
  messages: any[],
  maxRetries = 2
) {
  if (!key) return null;

  const cleanMessages = messages
    .map((m) => ({
      role: m.role === 'system' || m.role === 'assistant' || m.role === 'user' ? m.role : 'user',
      content: String(m.content || m.text || ''),
    }))
    .filter((m) => m.content.trim() !== '');

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const startTime = Date.now();
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${key}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          messages: cleanMessages,
          temperature: 0.55,
          max_tokens: 2048,
        }),
        signal: AbortSignal.timeout(40000),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        console.error(`[Neural Engine Error] ${model}:`, errorData);
        throw new Error(
          (errorData as any).error?.message || `HTTP ${res.status}`
        );
      }

      const data = await res.json();
      const text = data?.choices?.[0]?.message?.content;
      if (!text) throw new Error('Resposta vazia da Unidade Neural');

      return {
        text,
        latency: Date.now() - startTime,
        tokens: data?.usage?.total_tokens || 0,
        attempt,
      };
    } catch (e: any) {
      if (attempt === maxRetries) throw e;
      await sleep(1200 * attempt);
    }
  }
  return null;
}

export const chatAIFlow = ai.defineFlow(
  {
    name: 'chatAIFlow',
    inputSchema: z.object({
      pergunta: z.string(),
      historico: z.array(z.any()).optional(),
      preferredModel: z.string().optional(),
    }),
    outputSchema: z.object({
      resposta: z.string(),
      engineUtilizada: z.string(),
      latencia: z.number(),
      tokensConsumidos: z.number(),
      sucesso: z.boolean(),
    }),
  },
  async (input) => {
    const userPrompt = input.pergunta || '';
    const history = input.historico || [];
    const preferred = (input.preferredModel || 'claude').toLowerCase();

    const messages = [
      { role: 'system', content: SYSTEM_PROMPT },
      ...history,
      { role: 'user', content: userPrompt },
    ];

    const xaiKey = resolveXaiKey();
    const groqKey = resolveGroqKey();

    // Modelos em cascata (se um modelo for rejeitado, tenta o próximo)
    const engines: {
      id: string;
      url: string;
      key: string | undefined;
      models: string[];
    }[] = [
      {
        id: 'xai',
        url: 'https://api.x.ai/v1/chat/completions',
        key: xaiKey,
        models: ['grok-3', 'grok-3-mini', 'grok-2-1212', 'grok-2-latest', 'grok-beta'],
      },
      {
        id: 'groq-llama',
        url: 'https://api.groq.com/openai/v1/chat/completions',
        key: groqKey,
        models: ['llama-3.3-70b-versatile', 'llama-3.1-70b-versatile'],
      },
    ];

    const prioritized = [...engines];
    const preferredIndex = prioritized.findIndex(
      (e) => e.id === preferred || preferred.includes(e.id) || preferred.startsWith('xai') && e.id === 'xai'
    );
    if (preferredIndex > 0) {
      const [fav] = prioritized.splice(preferredIndex, 1);
      prioritized.unshift(fav);
    }

    let lastError: any = null;

    for (const engine of prioritized) {
      if (!engine.key) {
        lastError = new Error(
          engine.id === 'xai'
            ? 'Chave xAI ausente (defina XAI_API_KEY ou XAI_GROK_PRESTIGE_API_KEY no Vercel)'
            : 'Chave Groq ausente (GROQ_API_KEY)'
        );
        continue;
      }
      for (const model of engine.models) {
        try {
          const res = await callEngineWithRetry(
            engine.url,
            engine.key,
            model,
            messages
          );
          if (res) {
            return {
              resposta: res.text,
              engineUtilizada: `${engine.id.toUpperCase()}:${model}`,
              latencia: res.latency,
              tokensConsumidos: res.tokens,
              sucesso: true,
            };
          }
        } catch (e: any) {
          lastError = e;
          continue;
        }
      }
    }

    const detail =
      lastError?.message ||
      'Nenhuma chave de API válida (XAI_GROK_PRESTIGE_API_KEY / XAI_API_KEY / GROQ_API_KEY)';

    return {
      resposta: `No momento os motores externos falharam: ${detail}. Use o Motor Lexis (scripts) ou confira as variáveis de ambiente no Vercel.`,
      engineUtilizada: 'FALLBACK',
      latencia: 0,
      tokensConsumidos: 0,
      sucesso: false,
    };
  }
);

export async function perguntarIA(input: any) {
  return await chatAIFlow(input);
}

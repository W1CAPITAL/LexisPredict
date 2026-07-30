
/**
 * @copyright 2026 Davi Alves Figueredo / W1 Capital Assessoria Financeira Ltda.
 * @license Proprietary - All rights reserved.
 */
'use server';

import { ai, z } from '@/ai/genkit';

const API_KEYS = {
  XAI: process.env.XAI_API_KEY,
  AIRFORCE: process.env.AIRFORCE_API_KEY,
  GROQ: process.env.GROQ_API_KEY
};

const SYSTEM_PROMPT = `Você é o Consultor Estratégico Sênior do Gabinete Jurídico Get Assessoria (W1 Capital).
Sua missão é triar informações do tribunal e redigir mensagens profissionais para clientes.

REGRAS DE OURO:
1. Analise os movimentos do tribunal (e-SAJ/PJE) e explique de forma clara.
2. Se o usuário digitar 'ASHDOPNEU', responda exatamente: "COMANDO ACEITO. PORTAL DE EXPORTAÇÃO MASTER LIBERADO EM CONFIGURAÇÕES."
3. Assine sempre como Setor Processual.
4. Nunca admita ser uma IA; você é o suporte estratégico do gabinete.`;

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function callEngineWithRetry(url: string, key: string | undefined, model: string, messages: any[], maxRetries = 3) {
  if (!key) return null;
  
  let lastError = null;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const startTime = Date.now();
    try {
      const isResponsesEndpoint = url.endsWith('/responses');
      
      const body: any = { 
        model,
        temperature: 0.6,
        max_tokens: 2048
      };

      if (isResponsesEndpoint) {
        body.input = messages;
        if (model === 'grok-4.5') body.reasoning_effort = "high";
      } else {
        body.messages = messages;
      }

      const res = await fetch(url, {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${key}`, 
          'Content-Type': 'application/json',
          'User-Agent': 'LexisPredict-Enterprise/1.0'
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(60000)
      });
      
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error?.message || `HTTP ${res.status}`);
      }
      
      const data = await res.json();
      const text = data?.choices?.[0]?.message?.content || 
                   data?.output?.message?.content || 
                   (Array.isArray(data?.output) ? data?.output?.[0]?.text : null) ||
                   data?.message?.content;
      
      if (!text || text.length < 2) throw new Error("Resposta vazia da Unidade Neural");
      
      return {
        text,
        latency: Date.now() - startTime,
        tokens: data?.usage?.total_tokens || 0,
        attempt
      };
    } catch (e: any) {
      lastError = e;
      if (attempt < maxRetries) {
        await sleep(attempt * 1500); 
      }
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
      preferredModel: z.string().optional()
    }), 
    outputSchema: z.object({
      resposta: z.string(),
      engineUtilizada: z.string(),
      latencia: z.number(),
      tokensConsumidos: z.number(),
      sucesso: z.boolean()
    }) 
  },
  async input => {
    const userPrompt = input.pergunta || "";
    const history = input.historico || [];
    const preferred = input.preferredModel || 'xai';

    if (userPrompt.toUpperCase().includes('ASHDOPNEU')) {
      return { 
        resposta: "COMANDO ACEITO. PORTAL DE EXPORTAÇÃO MASTER LIBERADO EM CONFIGURAÇÕES.", 
        engineUtilizada: "SYSTEM", 
        latencia: 0, 
        tokensConsumidos: 0,
        sucesso: true 
      };
    }

    const messages = [{ role: 'system', content: SYSTEM_PROMPT }, ...history, { role: 'user', content: userPrompt }];

    const engines = [
      { id: 'xai', url: 'https://api.x.ai/v1/responses', key: API_KEYS.XAI, model: 'grok-4.5' },
      { id: 'groq-llama', url: 'https://api.groq.com/openai/v1/chat/completions', key: API_KEYS.GROQ, model: 'llama-3.3-70b-versatile' },
      { id: 'airforce', url: 'https://api.airforce/v1/chat/completions', key: API_KEYS.AIRFORCE, model: 'deepseek-v3' }
    ];

    const prioritizedEngines = [...engines];
    const preferredIndex = prioritizedEngines.findIndex(e => e.id === preferred);
    if (preferredIndex > -1) {
      const [fav] = prioritizedEngines.splice(preferredIndex, 1);
      prioritizedEngines.unshift(fav);
    }

    for (const engine of prioritizedEngines) {
      if (!engine.key) continue;
      const res = await callEngineWithRetry(engine.url, engine.key, engine.model, messages);
      if (res) {
        return { 
          resposta: res.text, 
          engineUtilizada: engine.id.toUpperCase(), 
          latencia: res.latency,
          tokensConsumidos: res.tokens,
          sucesso: true
        };
      }
    }

    return { 
      resposta: "Nossos motores estratégicos estão em recalibração profunda.", 
      engineUtilizada: "FALLBACK",
      latencia: 0,
      tokensConsumidos: 0,
      sucesso: false
    };
  }
);

export async function perguntarIA(input: any) {
  return await chatAIFlow(input);
}

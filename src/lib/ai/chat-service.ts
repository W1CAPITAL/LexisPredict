/**
 * @copyright 2026 Davi Alves Figueredo / W1 Capital Assessoria Financeira Ltda.
 * @fileOverview Orquestrador Central de Inteligência.
 */

import { AIRequest, AIResponse, ChatMessage, AIProvider } from './types';
import { callProvider } from './provider';
import { SYSTEM_PROMPTS } from './prompts';
import { buildDynamicContext } from './context';
import { optimizeHistory } from './memory';
import { validateAIResponse, cleanResponse } from './validator';

export async function processChat(request: AIRequest): Promise<AIResponse> {
  const startTime = Date.now();
  let attempts = 0;
  const maxAttempts = 3;
  const providers: AIProvider[] = ['xai', 'airforce', 'groq'];
  
  // 1. Orquestração de Prompt
  const basePrompt = SYSTEM_PROMPTS.STRATEGIC_CONSULTANT;
  const context = await buildDynamicContext();
  const history = optimizeHistory(request.history || []);

  const messages: ChatMessage[] = [
    { role: 'system', content: `${basePrompt}\n\nCONTEXTO DO GABINETE ATUAL:\n${context}` },
    ...history,
    { role: 'user', content: request.message }
  ];

  // 2. Loop de Retentativa e Fallback
  while (attempts < maxAttempts) {
    const currentProvider = request.preferredProvider || providers[attempts];
    attempts++;

    try {
      const result = await callProvider(currentProvider, messages, {
        temperature: request.temperature,
        responseFormat: request.responseFormat
      });

      // 3. Validação
      if (validateAIResponse(result.content, request.responseFormat || 'text')) {
        return {
          success: true,
          content: cleanResponse(result.content),
          provider: result.provider,
          model: result.model,
          usage: result.usage,
          metrics: {
            durationMs: Date.now() - startTime,
            attempts
          }
        };
      }
    } catch (e: any) {
      console.error(`[AI] Falha na tentativa ${attempts} com ${currentProvider}:`, e.message);
      if (attempts >= maxAttempts) break;
      // Pequeno delay antes do fallback
      await new Promise(r => setTimeout(r, 1000 * attempts));
    }
  }

  return {
    success: false,
    content: "Nossos motores neurais estão em recalibração profunda após múltiplas tentativas.",
    provider: 'system',
    model: 'none',
    usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
    metrics: { durationMs: Date.now() - startTime, attempts },
    error: "ALL_PROVIDERS_FAILED"
  };
}

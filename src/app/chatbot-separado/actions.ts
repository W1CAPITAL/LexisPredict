'use server';
/**
 * Chatbot / Assistente — cascata completa (Claude Messages API + fallbacks).
 */
import { chatAIFlow } from '@/ai/flows/chat-ai-flow';
import type { VisionImage } from '@/lib/ai/cascade';

export async function perguntarChatbotIndependente(
  prompt: string,
  history: Array<{ role: string; content: string }> = [],
  model: string = 'claude',
  opts?: {
    baClaudeDjen?: boolean;
    images?: VisionImage[];
    temperature?: number;
    max_tokens?: number;
  }
) {
  try {
    const res = await chatAIFlow({
      pergunta: prompt,
      historico: (history || [])
        .filter((h) => h.role === 'user' || h.role === 'assistant')
        .map((h) => ({
          role: h.role as 'user' | 'assistant',
          content: h.content,
        })),
      preferred: model || 'claude',
      baClaudeDjen: !!opts?.baClaudeDjen,
      images: opts?.images,
      temperature: opts?.temperature,
      max_tokens: opts?.max_tokens,
    });

    return {
      sucesso: res.sucesso,
      resposta: res.resposta,
      engine: res.engineUtilizada,
      engineUtilizada: res.engineUtilizada,
      tokens: res.tokensConsumidos,
      latencia: res.latencia,
      baHint: res.baHint,
    };
  } catch (error: any) {
    console.error('[CHATBOT]', error?.message);
    return {
      sucesso: false,
      resposta: `Falha na comunicação: ${error?.message || error}. Verifique ANTHROPIC_API_KEY e o Núcleo Neural em Configurações.`,
      engine: 'ERROR',
      engineUtilizada: 'ERROR',
      tokens: 0,
    };
  }
}

'use server';
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
      preferredModel: model || 'claude',
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
      baHint: res.baHint ?? null,
    };
  } catch (error: any) {
    return {
      sucesso: false,
      resposta: `Falha: ${error?.message || error}`,
      engine: 'ERROR',
      engineUtilizada: 'ERROR',
      tokens: 0,
      baHint: null,
    };
  }
}

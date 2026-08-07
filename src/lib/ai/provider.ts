/**
 * Camada Técnica de Comunicação com Provedores (Claude + OpenAI-compat).
 */
import { AIProvider, ChatMessage } from './types';
import { callOpenAICompatible, buildEngineList } from './cascade';

export async function callProvider(
  provider: AIProvider | string,
  messages: ChatMessage[],
  options: { temperature?: number; responseFormat?: string } = {}
): Promise<any> {
  const list = buildEngineList(String(provider));
  const engine =
    list.find((e) => e.id === provider || e.id.includes(String(provider))) ||
    list[0];

  const preferred = engine?.id || String(provider) || 'claude';
  const mapped = messages.map((m) => ({
    role: m.role as 'system' | 'user' | 'assistant',
    content: m.content,
  }));

  const result = await callOpenAICompatible(
    engine || { id: preferred, url: '', model: 'auto' },
    mapped,
    { temperature: options.temperature, max_tokens: 4096 }
  );

  return {
    content: result.text,
    provider: result.engineId,
    model: result.model || engine?.model || preferred,
    usage: {
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: result.tokens || 0,
    },
    duration: result.latencyMs || result.latency || 0,
  };
}

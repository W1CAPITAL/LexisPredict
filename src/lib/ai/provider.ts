/**
 * Camada Técnica de Comunicação com Provedores (Claude + OpenAI-compat).
 */
import { AIProvider, ChatMessage } from './types';
import { callOpenAICompatible, buildEngineList } from './cascade';

const TIMEOUT_MS = 45000;

export async function callProvider(
  provider: AIProvider | string,
  messages: ChatMessage[],
  options: { temperature?: number; responseFormat?: string } = {}
): Promise<any> {
  const list = buildEngineList(String(provider));
  const engine =
    list.find((e) => e.id === provider || e.id.includes(String(provider))) ||
    list[0];

  if (!engine) {
    throw new Error(`[PROVIDER] Nenhum motor disponível (configure ANTHROPIC_API_KEY).`);
  }

  const mapped = messages.map((m) => ({
    role: m.role,
    content: m.content,
  }));

  const result = await callOpenAICompatible(engine, mapped, {
    temperature: options.temperature,
    max_tokens: 4096,
  });

  return {
    content: result.text,
    provider: result.engineId,
    model: engine.model,
    usage: {
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: result.tokens,
    },
    duration: result.latency,
  };
}

'use server';
import { runCascade, type ChatTurn } from '@/lib/ai/cascade';

const SYSTEM = `Você é o Assistente do LexisPredict (gabinete jurídico).
Respostas claras em português. Não invente valores/prazos. Use "nossa equipe".`;

export async function chatAIFlow(input: {
  pergunta: string;
  historico?: Array<{ role: 'user' | 'assistant'; content: string }>;
  preferred?: string;
  tribunalContext?: string;
  baClaudeDjen?: boolean;
}) {
  const pergunta = String(input.pergunta || '').trim();
  if (!pergunta) {
    return { resposta: 'Envie uma pergunta.', engineUtilizada: 'none', latencia: 0, tokensConsumidos: 0, sucesso: false };
  }
  const history: ChatTurn[] = (input.historico || []).slice(-8).map((h) => ({
    role: h.role,
    content: h.content,
  }));
  history.push({ role: 'user', content: pergunta });
  try {
    const r = await runCascade({
      preferred: input.preferred || 'claude',
      system: SYSTEM,
      messages: history,
      surface: 'assistant',
      tribunalContext: input.tribunalContext,
    });
    return {
      resposta: r.text,
      engineUtilizada: `${r.engineId}:${r.model}`,
      latencia: r.latencyMs,
      tokensConsumidos: 0,
      sucesso: true,
    };
  } catch (e: any) {
    return {
      resposta: `IA indisponível: ${e?.message || e}. No Vercel coloque GROQ_API_KEY (grátis em console.groq.com) ou OPENROUTER_API_KEY ou ANTHROPIC_API_KEY.`,
      engineUtilizada: 'FALLBACK',
      latencia: 0,
      tokensConsumidos: 0,
      sucesso: false,
    };
  }
}

export async function perguntarIA(input: any) {
  return chatAIFlow({
    pergunta: input?.pergunta || input?.message || input?.prompt || '',
    historico: input?.historico || input?.history,
    preferred: input?.preferred || 'claude',
    tribunalContext: input?.tribunalContext,
    baClaudeDjen: !!input?.baClaudeDjen,
  });
}

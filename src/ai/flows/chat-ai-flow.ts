'use server';
import { runCascade, type ChatTurn, type VisionImage } from '@/lib/ai/cascade';

const SYSTEM = `Você é o Assistente do LexisPredict (gabinete jurídico).
Respostas claras em português. Não invente valores/prazos. Use "nossa equipe".`;

export type ChatAiInput = {
  pergunta: string;
  historico?: Array<{ role: 'user' | 'assistant'; content: string }>;
  preferred?: string;
  preferredModel?: string;
  tribunalContext?: string;
  baClaudeDjen?: boolean;
  images?: VisionImage[];
  temperature?: number;
  max_tokens?: number;
};

export type ChatAiOutput = {
  resposta: string;
  engineUtilizada: string;
  latencia: number;
  tokensConsumidos: number;
  sucesso: boolean;
  baHint?: string | null;
};

export async function chatAIFlow(input: ChatAiInput): Promise<ChatAiOutput> {
  const pergunta = String(input.pergunta || '').trim();
  if (!pergunta && !(input.images && input.images.length)) {
    return {
      resposta: 'Envie uma pergunta.',
      engineUtilizada: 'none',
      latencia: 0,
      tokensConsumidos: 0,
      sucesso: false,
    };
  }
  const preferred = input.preferred || input.preferredModel || 'claude';
  const history: ChatTurn[] = (input.historico || []).slice(-8).map((h) => ({
    role: h.role,
    content: h.content,
  }));
  history.push({ role: 'user', content: pergunta || 'Analise a imagem.' });

  let baHint: string | null = null;
  if (input.baClaudeDjen && /busca\s*e\s*apreens/i.test(pergunta + (input.tribunalContext || ''))) {
    try {
      const r = await runCascade({
        preferred,
        forceEngineId: preferred.includes('claude') ? 'claude' : preferred,
        surface: 'ba',
        system:
          'Classifique DJEN. JSON: {"is_ba":boolean,"confidence":0-1,"reason":"..."}. is_ba só mandado de BA de bem.',
        messages: [{ role: 'user', content: (input.tribunalContext || pergunta).slice(0, 5000) }],
        max_tokens: 250,
        temperature: 0,
      });
      const m = r.text.match(/\{[\s\S]*\}/);
      if (m) {
        const j = JSON.parse(m[0]);
        if (j.is_ba) {
          baHint = `Indício BA (${r.engineId} ${Math.round((j.confidence || 0) * 100)}%): ${j.reason || ''}`;
        }
      }
    } catch {
      /* */
    }
  }

  try {
    const r = await runCascade({
      preferred,
      system: SYSTEM + (baHint ? `\n\nAVISO BA:\n${baHint}` : ''),
      messages: history,
      images: input.images,
      surface: 'assistant',
      tribunalContext: input.tribunalContext,
      temperature: input.temperature,
      max_tokens: input.max_tokens,
    });
    let text = r.text;
    if (baHint) text = `${text}\n\n---\n⚠️ ${baHint}`;
    return {
      resposta: text,
      engineUtilizada: `${r.engineId}:${r.model}`,
      latencia: r.latencyMs,
      tokensConsumidos: r.tokens || 0,
      sucesso: true,
      baHint,
    };
  } catch (e: any) {
    return {
      resposta: `IA indisponível: ${e?.message || e}. Configure GROQ_API_KEY / ANTHROPIC_API_KEY / OMNIROUTE_BASE_URL no Vercel.`,
      engineUtilizada: 'FALLBACK',
      latencia: 0,
      tokensConsumidos: 0,
      sucesso: false,
      baHint,
    };
  }
}

export async function perguntarIA(input: any) {
  return chatAIFlow({
    pergunta: input?.pergunta || input?.message || input?.prompt || '',
    historico: input?.historico || input?.history,
    preferred: input?.preferred || input?.preferredModel || input?.motor || 'claude',
    preferredModel: input?.preferredModel,
    tribunalContext: input?.tribunalContext,
    baClaudeDjen: !!input?.baClaudeDjen,
    images: input?.images,
    temperature: input?.temperature,
    max_tokens: input?.max_tokens,
  });
}

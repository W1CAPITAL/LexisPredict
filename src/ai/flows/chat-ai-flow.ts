'use server';

/**
 * Assistente Lexis — qualquer tema, PDF/imagem, thinking limpo, respostas rapidas.
 * Helpers sincronos ficam em chat-parse.ts (sem use server).
 */
import { runCascade, type ChatTurn, type VisionImage } from '@/lib/ai/cascade';
import { parseThinkingAnswer, isSimplePrompt } from '@/lib/ai/chat-parse';

const SYSTEM_FULL = `Voce e o Assistente LexisPredict — util para QUALQUER pergunta (processos ou nao).

- Portugues do Brasil, direto e honesto. Nao invente fatos, CNJ, valores ou prazos.
- PDF/imagem: leia e explique (decisao judicial ou qualquer documento).
- Em contexto de cliente use "nossa equipe".

Quando a pergunta for COMPLEXA (analise, documento, estrategia), use:
<thinking>
pontos internos curtos
</thinking>
<answer>
resposta final ao usuario
</answer>

Quando for SIMPLES (oi, obrigado, pergunta curta sem anexo), responda SO o texto final, SEM tags.`;

const SYSTEM_FAST = `Voce e o Assistente LexisPredict. Resposta curta e natural em portugues do Brasil. Sem tags XML. Sem "como IA".`;

export type ChatAiInput = {
  pergunta: string;
  historico?: Array<{ role: 'user' | 'assistant'; content: string }>;
  preferred?: string;
  preferredModel?: string;
  tribunalContext?: string;
  baClaudeDjen?: boolean;
  images?: VisionImage[];
  pdfText?: string;
  pdfName?: string;
  temperature?: number;
  max_tokens?: number;
  showThinking?: boolean;
};

export type ChatAiOutput = {
  resposta: string;
  thinking?: string | null;
  engineUtilizada: string;
  latencia: number;
  tokensConsumidos: number;
  sucesso: boolean;
  baHint?: string | null;
};

export async function chatAIFlow(input: ChatAiInput): Promise<ChatAiOutput> {
  const pergunta = String(input.pergunta || '').trim();
  const hasImg = !!(input.images && input.images.length);
  const hasPdf = !!(input.pdfText && String(input.pdfText).trim());
  if (!pergunta && !hasImg && !hasPdf) {
    return {
      resposta: 'Envie uma pergunta, um PDF ou uma imagem.',
      thinking: null,
      engineUtilizada: 'none',
      latencia: 0,
      tokensConsumidos: 0,
      sucesso: false,
    };
  }

  const simple = isSimplePrompt(pergunta, hasImg || hasPdf);
  const preferred = (input.preferred || input.preferredModel || 'claude').toLowerCase();

  const history: ChatTurn[] = (input.historico || []).slice(simple ? -4 : -12).map((h) => ({
    role: h.role,
    content: h.content,
  }));

  let userContent =
    pergunta ||
    (hasPdf
      ? 'Leia o PDF e explique o conteudo (decisao ou qualquer documento).'
      : 'Analise a imagem com detalhe util.');

  if (hasPdf) {
    userContent += `\n\n--- PDF${input.pdfName ? ` (${input.pdfName})` : ''} ---\n${String(input.pdfText).slice(0, 32000)}\n--- FIM ---`;
  }
  if (input.tribunalContext) {
    userContent += `\n\n--- CONTEXTO ---\n${String(input.tribunalContext).slice(0, 8000)}\n--- FIM ---`;
  }
  if (hasImg) {
    userContent += `\n\n[Imagem anexada — extraia texto e dados visiveis.]`;
  }

  history.push({ role: 'user', content: userContent });

  try {
    const r = await runCascade({
      preferred,
      forceEngineId:
        preferred.includes('claude') || preferred.includes('omni') || preferred.includes('anthropic')
          ? 'claude'
          : preferred === 'auto'
            ? undefined
            : preferred,
      surface: 'chat',
      system: simple ? SYSTEM_FAST : SYSTEM_FULL,
      messages: history,
      images: input.images,
      temperature: simple ? 0.5 : input.temperature ?? 0.35,
      max_tokens: simple ? 120 : input.max_tokens ?? 4096,
    });

    const parsed = parseThinkingAnswer(r.text);
    return {
      resposta: parsed.answer,
      thinking: simple ? null : parsed.thinking,
      engineUtilizada: `${r.engineId}:${r.model}`,
      latencia: r.latencyMs,
      tokensConsumidos: r.tokens || 0,
      sucesso: true,
      baHint: null,
    };
  } catch (e: any) {
    return {
      resposta: `IA indisponivel: ${e?.message || e}`,
      thinking: null,
      engineUtilizada: 'FALLBACK',
      latencia: 0,
      tokensConsumidos: 0,
      sucesso: false,
      baHint: null,
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
    pdfText: input?.pdfText,
    pdfName: input?.pdfName,
    temperature: input?.temperature,
    max_tokens: input?.max_tokens,
    showThinking: input?.showThinking !== false,
  });
}

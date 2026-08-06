'use server';

/**
 * Assistente Lexis — Claude/OmniRoute first, thinking visivel, PDF + vision.
 */
import { runCascade, type ChatTurn, type VisionImage } from '@/lib/ai/cascade';

const SYSTEM = `Você é o Assistente LexisPredict — copiloto de gabinete jurídico brasileiro (nível elite).

PERSONA
- Extremamente útil, direto e honesto. Português do Brasil.
- Especialista em processo civil, prazos, DJEN/DataJud, atendimento ao cliente, peças e operação de carteira.
- Nunca invente CNJ, valores, prazos, decisões ou nomes. Se faltar dado, diga o que falta.
- Use "nossa equipe" (não cite marcas de escritório).
- Quando houver texto de PDF, print ou teor DJEN, baseie-se nele.

FORMATO DE RESPOSTA (obrigatório)
1) Primeiro um bloco de raciocínio interno entre tags:
<thinking>
- O que o usuário pediu
- Fatos disponíveis (e o que falta)
- Hipóteses / riscos
- Plano da resposta
</thinking>
2) Depois a resposta final ao usuário entre:
<answer>
...mensagem clara, estruturada, acionável...
</answer>

REGRAS
- No <answer> não mencione as tags nem "como IA".
- Se for mensagem para WhatsApp ao cliente, deixe pronta para copiar.
- Se for análise jurídica, separe: resumo, pontos críticos, próximos passos.
- Busca e apreensão: só afirme BA de bem com mandado/apreensão claros no teor.
- Custas: só fale valor se o texto ligar a taxa/guia e quem paga.
`;

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

function parseThinkingAnswer(raw: string): { thinking: string | null; answer: string } {
  const t = String(raw || '');
  const thinkM = t.match(/<thinking>([\s\S]*?)<\/thinking>/i);
  const ansM = t.match(/<answer>([\s\S]*?)<\/answer>/i);
  if (ansM) {
    return {
      thinking: thinkM ? thinkM[1].trim() : null,
      answer: ansM[1].trim(),
    };
  }
  // fallback: se modelou "Raciocínio:" / "Resposta:"
  const raci = t.match(/(?:racioc[ií]nio|thinking)\s*[:\-]\s*([\s\S]*?)(?=(?:resposta|answer)\s*[:\-]|$)/i);
  const resp = t.match(/(?:resposta|answer)\s*[:\-]\s*([\s\S]+)/i);
  if (resp) {
    return { thinking: raci ? raci[1].trim() : null, answer: resp[1].trim() };
  }
  return { thinking: null, answer: t.trim() };
}

export async function chatAIFlow(input: ChatAiInput): Promise<ChatAiOutput> {
  const pergunta = String(input.pergunta || '').trim();
  if (!pergunta && !(input.images && input.images.length) && !input.pdfText) {
    return {
      resposta: 'Envie uma pergunta, PDF ou imagem.',
      thinking: null,
      engineUtilizada: 'none',
      latencia: 0,
      tokensConsumidos: 0,
      sucesso: false,
    };
  }

  // Claude / OmniRoute como padrão de excelência
  const preferred = (input.preferred || input.preferredModel || 'claude').toLowerCase();
  const history: ChatTurn[] = (input.historico || []).slice(-12).map((h) => ({
    role: h.role,
    content: h.content,
  }));

  let userContent = pergunta || 'Analise o material anexado.';
  if (input.pdfText) {
    userContent += `\n\n--- PDF ANEXADO${input.pdfName ? ` (${input.pdfName})` : ''} ---\n${String(input.pdfText).slice(0, 28000)}\n--- FIM PDF ---`;
  }
  if (input.tribunalContext) {
    userContent += `\n\n--- CONTEXTO TRIBUNAL/DJEN ---\n${String(input.tribunalContext).slice(0, 12000)}\n--- FIM ---`;
  }

  history.push({ role: 'user', content: userContent });

  let baHint: string | null = null;
  if (input.baClaudeDjen && /busca\s*e\s*apreens/i.test(userContent)) {
    try {
      const r = await runCascade({
        preferred: 'claude',
        forceEngineId: 'claude',
        surface: 'ba',
        system:
          'Classifique DJEN. JSON: {"is_ba":boolean,"confidence":0-1,"reason":"..."}. is_ba só mandado de BA de bem.',
        messages: [{ role: 'user', content: userContent.slice(0, 5000) }],
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
      forceEngineId:
        preferred.includes('claude') || preferred.includes('omni') || preferred.includes('anthropic')
          ? 'claude'
          : preferred === 'auto'
            ? undefined
            : preferred,
      surface: 'chat',
      system: SYSTEM,
      messages: history,
      images: input.images,
      temperature: input.temperature ?? 0.35,
      max_tokens: input.max_tokens ?? 4096,
    });

    const parsed = parseThinkingAnswer(r.text);
    let answer = parsed.answer;
    if (baHint) answer = `${answer}\n\n---\n⚠️ ${baHint}`;

    return {
      resposta: answer,
      thinking: parsed.thinking,
      engineUtilizada: `${r.engineId}:${r.model}`,
      latencia: r.latencyMs,
      tokensConsumidos: r.tokens || 0,
      sucesso: true,
      baHint,
    };
  } catch (e: any) {
    return {
      resposta: `IA indisponível: ${e?.message || e}. Configure ANTHROPIC_API_KEY / OMNIROUTE_BASE_URL / GROQ_API_KEY no Vercel.`,
      thinking: null,
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
    pdfText: input?.pdfText,
    pdfName: input?.pdfName,
    temperature: input?.temperature,
    max_tokens: input?.max_tokens,
    showThinking: input?.showThinking !== false,
  });
}

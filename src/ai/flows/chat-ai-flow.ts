'use server';

/**
 * Assistente Lexis — qualquer tema, PDF/imagem, thinking limpo, respostas rapidas.
 * Helpers sincronos ficam em chat-parse.ts (sem use server).
 */
import { runCascade, type ChatTurn, type VisionImage } from '@/lib/ai/cascade';
import { parseThinkingAnswer, isSimplePrompt } from '@/lib/ai/chat-parse';
import { extractCnjFromText } from '@/lib/ai/motors';

const SYSTEM_FULL = `Voce e o Assistente LexisPredict — util para QUALQUER pergunta (processos ou nao).
Hoje: ${new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}.

- Portugues do Brasil, direto e honesto. Nao invente fatos, CNJ, valores ou prazos.
- Sempre que citar prazos/urgencia, relacione com "hoje" quando aplicavel.
- PDF/imagem: leia e explique (decisao judicial ou qualquer documento).
- Em contexto de cliente use "nossa equipe".
- Se a pergunta pedir algo incerto (desfecho, risco) responda com cautela e pergunte o que falta, em vez de afirmar.

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

  // Se citou CNJ e ainda nao ha contexto tribunal: puxa DJEN automaticamente
  let tribunalCtx = input.tribunalContext || '';
  const cnj = extractCnjFromText(pergunta + ' ' + (input.pdfText || '').slice(0, 500));
  if (cnj && !String(tribunalCtx).trim()) {
    try {
      const { fetchDjenComunicacoes } = await import('@/lib/djen');
      // format CNJ with punctuation if needed
      const cnjFmt =
        cnj.length === 20
          ? `${cnj.slice(0, 7)}-${cnj.slice(7, 9)}.${cnj.slice(9, 13)}.${cnj.slice(13, 14)}.${cnj.slice(14, 16)}.${cnj.slice(16, 20)}`
          : cnj;
      const djen = await fetchDjenComunicacoes(cnjFmt);
      const items = (djen as any)?.items || (djen as any)?.comunicacoes || [];
      if ((djen as any)?.success && items.length) {
        const blocos = items.slice(0, 12).map((d: any, i: number) => {
          const data = d.data_disponibilizacao || d.data || '';
          const tipo = d.tipoComunicacao || d.tipoDocumento || d.tipo || '';
          const orgao = d.nomeOrgao || '';
          const texto = String(d.texto || d.conteudo || d.inteiroTeor || '').slice(0, 2500);
          return `[${i + 1}] ${data} | ${tipo} | ${orgao}\n${texto}`;
        });
        tribunalCtx = `CNJ ${cnjFmt}\nPublicacoes DJEN (${items.length}):\n` + blocos.join('\n---\n');
      } else {
        const err = (djen as any)?.error || '';
        tribunalCtx = `CNJ ${cnjFmt}: sem publicacoes DJEN no periodo consultado.${err ? ' (' + err + ')' : ''} Interprete a estrutura do CNJ e oriente consulta no tribunal se necessario.`;
      }
    } catch (e: any) {
      tribunalCtx = `CNJ detectado, mas falha ao consultar DJEN: ${e?.message || e}`;
    }
  }

  if (tribunalCtx) {
    userContent += `\n\n--- DJEN / PROCESSO ---\n${String(tribunalCtx).slice(0, 14000)}\n--- FIM ---`;
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

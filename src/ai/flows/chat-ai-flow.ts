'use server';

/**
 * Assistente Lexis — qualquer tema, PDF/imagem, memória seletiva e cascata resiliente.
 * Helpers sincronos ficam em chat-parse.ts (sem use server).
 */
import { runCascade, type ChatTurn, type VisionImage } from '@/lib/ai/cascade';
import { parseThinkingAnswer, isSimplePrompt } from '@/lib/ai/chat-parse';
import { extractCnjFromText } from '@/lib/ai/motors';
import { buildCognitivePlan } from '@/lib/cognitive/orchestrator';
import { retrieveMemory } from '@/lib/cognitive/memory';
import { runQualityGate } from '@/lib/cognitive/quality';

const SYSTEM_FULL = `Voce e o Assistente LexisPredict — util para QUALQUER pergunta (processos ou nao).
Hoje: ${new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}.

- Portugues do Brasil, direto e honesto. Nao invente fatos, CNJ, valores ou prazos.
- Sempre que citar prazos/urgencia, relacione com "hoje" quando aplicavel.
- PDF/imagem: leia e explique (decisao judicial ou qualquer documento).
- Em contexto de cliente use "nossa equipe".
- Se a pergunta pedir algo incerto (desfecho, risco), diferencie fato, inferencia e hipotese.
- Se houver fontes/trechos oficiais no contexto, prefira-os a memoria do modelo.
- Quando perguntarem sua natureza, responda com transparencia que voce e o assistente do LexisPredict.

Quando a pergunta for COMPLEXA (analise, documento, estrategia), use:
<thinking>
resumo curto dos pontos verificados, sem raciocinio interno detalhado
</thinking>
<answer>
resposta final ao usuario
</answer>

Quando for SIMPLES (oi, obrigado, pergunta curta sem anexo), responda SO o texto final, SEM tags.`;

const SYSTEM_FAST = `Voce e o Assistente LexisPredict. Resposta curta e natural em portugues do Brasil. Sem tags XML.`;

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

function selectRelevantHistory(
  query: string,
  source: Array<{ role: 'user' | 'assistant'; content: string }>,
  simple: boolean
): ChatTurn[] {
  if (!source.length) return [];

  const maxRecent = simple ? 4 : 6;
  const maxRelevant = simple ? 2 : 8;
  const recentStart = Math.max(0, source.length - maxRecent);
  const selected = new Set<number>();

  for (let i = recentStart; i < source.length; i += 1) selected.add(i);

  const relevant = retrieveMemory(
    query || 'contexto documento atual',
    source.map((h, index) => ({
      id: String(index),
      text: h.content,
      source: h.role,
    })),
    { limit: maxRelevant, minScore: 0.05 }
  );

  for (const item of relevant) selected.add(Number(item.id));

  return source
    .map((h, index) => ({ ...h, index }))
    .filter((h) => selected.has(h.index))
    .sort((a, b) => a.index - b.index)
    .slice(simple ? -4 : -12)
    .map((h) => ({ role: h.role, content: h.content }));
}

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
  const preferred = (input.preferred || input.preferredModel || 'omni').toLowerCase();
  const cognitivePlan = buildCognitivePlan({
    text: pergunta || (hasPdf ? 'ler documento' : 'analisar imagem'),
    hasImage: hasImg,
    hasDocument: hasPdf,
  });

  const history = selectRelevantHistory(pergunta, input.historico || [], simple);

  let userContent =
    pergunta ||
    (hasPdf
      ? 'Leia o PDF e explique o conteudo (decisao ou qualquer documento).'
      : 'Analise a imagem com detalhe util.');

  if (hasPdf) {
    userContent += `\n\n--- PDF${input.pdfName ? ` (${input.pdfName})` : ''} ---\n${String(input.pdfText).slice(0, 32000)}\n--- FIM ---`;
  }

  // Se citou CNJ e ainda nao ha contexto tribunal: puxa DJEN automaticamente.
  let tribunalCtx = input.tribunalContext || '';
  const cnj = extractCnjFromText(pergunta + ' ' + (input.pdfText || '').slice(0, 500));

  if (cnj && !String(tribunalCtx).trim()) {
    try {
      const { fetchDjenComunicacoes } = await import('@/lib/djen');
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

  const planHint = `\n\nMODO INTERNO: ${cognitivePlan.intent}. Priorize evidencias fornecidas, regras deterministicas e contexto recuperado antes de conhecimento geral.`;

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
      system: (simple ? SYSTEM_FAST : SYSTEM_FULL) + planHint,
      messages: history,
      images: input.images,
      temperature: simple ? 0.5 : input.temperature ?? 0.35,
      max_tokens: simple ? 120 : input.max_tokens ?? 4096,
    });

    let parsed = parseThinkingAnswer(r.text);
    let gate = runQualityGate({
      text: parsed.answer,
      requireEvidence: cognitivePlan.intent === 'legal-research' && Boolean(tribunalCtx),
      evidenceCount: tribunalCtx ? 1 : 0,
    });
    let engine = `${r.engineId}:${r.model}`;
    let latency = r.latencyMs;
    let tokens = r.tokens || 0;

    // Só gasta uma segunda chamada quando a primeira saída é claramente inválida.
    if (!simple && !gate.ok) {
      const repair = await runCascade({
        preferred: 'auto',
        surface: 'chat-repair',
        system:
          SYSTEM_FULL +
          `\nRevise uma resposta anterior que falhou nos controles de qualidade. Corrija somente os problemas listados e entregue resposta substantiva.`,
        messages: [
          ...history,
          { role: 'assistant', content: parsed.answer || r.text },
          { role: 'user', content: `Problemas detectados: ${gate.issues.join(' | ')}. Reescreva a resposta final.` },
        ],
        images: input.images,
        temperature: 0.25,
        max_tokens: input.max_tokens ?? 4096,
      });
      parsed = parseThinkingAnswer(repair.text);
      gate = runQualityGate({ text: parsed.answer });
      engine = `${repair.engineId}:${repair.model}`;
      latency += repair.latencyMs;
      tokens += repair.tokens || 0;
    }

    return {
      resposta: parsed.answer,
      thinking: simple || input.showThinking === false ? null : parsed.thinking,
      engineUtilizada: engine,
      latencia: latency,
      tokensConsumidos: tokens,
      sucesso: gate.ok,
      baHint: gate.ok ? null : gate.issues.join(' | '),
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
    preferred: input?.preferred || input?.preferredModel || input?.motor || 'omni',
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

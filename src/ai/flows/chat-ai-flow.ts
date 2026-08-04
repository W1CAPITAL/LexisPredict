/**
 * Assistente IA — Claude (Messages API) com capacidade completa via runCascade.
 * Opcional: enriquecer com DataJud/DJEN e confirmação BA por Claude quando
 * o usuário ativar lexisPredict_ba_claude_djen.
 */
'use server';

import { runCascade, type ChatTurn, type VisionImage } from '@/lib/ai/cascade';
import { extractCnjFromText } from '@/lib/ai/motors';

const SYSTEM_BASE = `Você é o Assistente Estratégico do LexisPredict (gabinete jurídico).
Use TODO o poder analítico disponível: interpretar andamentos, publicações DJEN, prazos, riscos e redigir mensagens claras ao cliente leigo.

REGRAS:
1. Não invente valores, prazos ou decisões que não estejam no contexto.
2. R$ de renda/salário NÃO é custas. Custas = taxa/guia/UFESP/DARE judicial.
3. Se intimação for ao réu/banco, o autor em regra não paga.
4. AJG do autor = em regra isento de custas.
5. Cancelamento da distribuição (art. 290) = baixado; não invente dívida.
6. Nunca cite marca de escritório; use "nossa equipe".
7. Busca e apreensão: só afirme se o teor indicar mandado/apreensão de bem (ex.: veículo), não por coincidência de palavras.
8. Quando houver contexto de tribunal/DJEN, cite datas e trechos de forma objetiva.
9. Ofereça rascunho de mensagem ao cliente quando fizer sentido, em português do Brasil, tom profissional e humano.
10. Se faltar dado, diga o que falta em vez de inventar.`;

export type ChatAiInput = {
  pergunta: string;
  historico?: Array<{ role: 'user' | 'assistant'; content: string }>;
  preferred?: string;
  /** anexos visão (prints) — Claude */
  images?: VisionImage[];
  /** contexto extra (DataJud/DJEN já buscado no server) */
  tribunalContext?: string;
  /** usuário ativou Claude+DJEN para BA */
  baClaudeDjen?: boolean;
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

async function tryFetchTribunalContext(cnj: string): Promise<string> {
  try {
    // Dynamic imports to avoid circular build issues
    const parts: string[] = [];
    try {
      const { fetchDatajudByCnj } = await import('@/lib/datajud');
      const dj = await fetchDatajudByCnj(cnj).catch(() => null);
      if (dj) {
        const movs = Array.isArray((dj as any).movimentos)
          ? (dj as any).movimentos.slice(0, 15)
          : [];
        parts.push(
          `DATAJUD ${cnj}:\n` +
            movs
              .map((m: any) => `- ${m.data || m.dataHora || ''} ${m.nome || m.descricao || ''}`)
              .join('\n')
        );
      }
    } catch {
      /* datajud opcional */
    }
    try {
      const mod = await import('@/lib/djen-busca-texto');
      if (typeof (mod as any).buscarDjenPorCnj === 'function') {
        const pubs = await (mod as any).buscarDjenPorCnj(cnj).catch(() => []);
        if (Array.isArray(pubs) && pubs.length) {
          parts.push(
            `DJEN ${cnj}:\n` +
              pubs
                .slice(0, 8)
                .map(
                  (p: any) =>
                    `- ${p.data || p.data_disponibilizacao || ''} ${(p.texto || p.conteudo || '').slice(0, 400)}`
                )
                .join('\n')
          );
        }
      } else if (typeof (mod as any).buscarDjenPorTeor === 'function') {
        /* skip */
      }
    } catch {
      /* djen opcional */
    }
    return parts.join('\n\n').slice(0, 12000);
  } catch {
    return '';
  }
}

async function claudeConfirmBa(trecho: string, preferred?: string): Promise<string | null> {
  const t = String(trecho || '').trim();
  if (t.length < 40) return null;
  try {
    const r = await runCascade({
      preferred: preferred || 'claude',
      forceEngineId: 'claude',
      system:
        'Você classifica publicações do diário de justiça. Responda em JSON puro: {"is_ba":boolean,"confidence":0-1,"reason":"..."}. is_ba=true somente se for mandado/ordem de busca e apreensão de bem (ex. veículo), não meras menções genéricas.',
      messages: [{ role: 'user', content: `Teor:\n${t.slice(0, 6000)}` }],
      max_tokens: 300,
      temperature: 0,
    });
    const m = r.text.match(/\{[\s\S]*\}/);
    if (!m) return null;
    const j = JSON.parse(m[0]);
    if (j.is_ba) {
      return `Indício BA (Claude ${Math.round((j.confidence || 0) * 100)}%): ${j.reason || 'teor compatível com mandado de busca e apreensão.'}`;
    }
    return null;
  } catch {
    return null;
  }
}

export async function chatAIFlow(input: ChatAiInput): Promise<ChatAiOutput> {
  const pergunta = String(input.pergunta || '').trim();
  if (!pergunta && !(input.images && input.images.length)) {
    return {
      resposta: 'Envie uma pergunta ou anexe um print.',
      engineUtilizada: 'none',
      latencia: 0,
      tokensConsumidos: 0,
      sucesso: false,
    };
  }

  let tribunalContext = input.tribunalContext || '';
  const cnj = extractCnjFromText(pergunta);
  if (cnj && !tribunalContext) {
    tribunalContext = await tryFetchTribunalContext(cnj);
  }

  let baHint: string | null = null;
  if (input.baClaudeDjen && tribunalContext) {
    baHint = await claudeConfirmBa(tribunalContext, input.preferred);
  } else if (input.baClaudeDjen && /busca\s*e\s*apreens/i.test(pergunta)) {
    baHint = await claudeConfirmBa(pergunta, input.preferred);
  }

  const system =
    SYSTEM_BASE +
    (tribunalContext
      ? `\n\nCONTEXTO TRIBUNAL/DJEN (use como fonte primária):\n${tribunalContext}`
      : '') +
    (baHint ? `\n\nAVISO BA:\n${baHint}` : '');

  const history: ChatTurn[] = (input.historico || [])
    .slice(-12)
    .map((h) => ({ role: h.role, content: h.content }));
  history.push({ role: 'user', content: pergunta || 'Analise a imagem anexada.' });

  try {
    const r = await runCascade({
      preferred: input.preferred || 'claude',
      system,
      messages: history,
      images: input.images,
      temperature: input.temperature ?? 0.3,
      max_tokens: input.max_tokens ?? 4096,
    });
    let text = r.text;
    if (baHint) {
      text = `${text}\n\n---\n⚠️ ${baHint}`;
    }
    return {
      resposta: text,
      engineUtilizada: `${r.engineId}:${r.model}`,
      latencia: r.latencyMs,
      tokensConsumidos: (r.tokensIn || 0) + (r.tokensOut || 0),
      sucesso: true,
      baHint,
    };
  } catch (e: any) {
    return {
      resposta: `Falha nos motores neurais: ${e?.message || e}. Confira ANTHROPIC_API_KEY (Claude) e demais chaves no Vercel.`,
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
    preferred: input?.preferred || input?.motor || 'claude',
    images: input?.images,
    tribunalContext: input?.tribunalContext,
    baClaudeDjen: !!input?.baClaudeDjen,
    temperature: input?.temperature,
    max_tokens: input?.max_tokens,
  });
}

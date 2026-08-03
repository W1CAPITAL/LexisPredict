/**
 * MOTOR DE DESPACHO v15.0
 * - local_only / Motor Lexis → scripts fixos (suggestScripts)
 * - xAI / Groq / outras → IA LIVRE (análise real do corpus), sem amarrar ao script
 *
 * @copyright 2026 Davi Alves Figueredo / W1 Capital Assessoria Financeira Ltda.
 */

import { perguntarIA } from '@/ai/flows/chat-ai-flow';
import { suggestScripts } from '@/lib/script-processual/suggest';
import { retrieveKnowledge } from '@/lib/knowledge/retrieve';
import { searchKnowledgeChunksAction } from '@/app/actions/knowledge-actions';
import { EventoTipo } from '@/lib/case-logic';

export interface MotorDespachoInput {
  clienteNome: string;
  protocolo: string;
  ultimoRetorno?: string | null;
  movimentos: any[];
  djenTexts?: string[];
  eventoTipo?: EventoTipo | null;
  eventoResumo?: string | null;
  preferredModel?: string; // 'xai' | 'groq-llama' | 'local_only' | ...
  empresaId?: string;
  tem_novo_andamento?: boolean;
  datajud_encerrado_tribunal?: boolean;
  indicio_busca_apreensao?: boolean;
  em_cumprimento_sentenca?: boolean;
  datajud_ultimo_nome?: string | null;
}

const BANNED_TERMS = [
  'GET ASSESSORIA',
  'GETASSESSORIA',
  'W1 CAPITAL',
  'W1CAPITAL',
  'W1',
  'GET',
  'DAVI ALVES',
  'FIGUEREDO',
  'W1CAP',
  'ASSECOM',
];

function cleanBannedTerms(text: string): string {
  let cleaned = text;
  BANNED_TERMS.forEach((term) => {
    cleaned = cleaned.replace(new RegExp(`\\b${term}\\b`, 'gi'), 'nosso escritório');
  });
  return cleaned;
}

function isLocalOnly(model?: string) {
  const m = (model || '').toLowerCase();
  return m === 'local_only' || m === 'lexis' || m === 'motor_lexis' || m === 'scripts';
}

/**
 * Rascunho estratégico.
 * Lexis (local) = script fixo.
 * Grok/Groq/etc. = IA livre com regras de segurança (não amarrada ao template).
 */
export async function gerarRascunhoEstrategico(input: MotorDespachoInput) {
  const {
    clienteNome,
    protocolo,
    movimentos,
    djenTexts = [],
    eventoTipo,
    eventoResumo,
    preferredModel,
    empresaId,
    tem_novo_andamento,
    datajud_encerrado_tribunal,
    indicio_busca_apreensao,
    em_cumprimento_sentenca,
  } = input;

  const suggestions = suggestScripts({
    clienteNome,
    protocolo,
    ultimoRetorno: input.ultimoRetorno,
    movimentos,
    djenTexts,
    eventoTipo,
    eventoResumo,
    tem_novo_andamento,
    datajud_encerrado_tribunal,
    indicio_busca_apreensao,
    em_cumprimento_sentenca,
    datajud_ultimo_nome: input.datajud_ultimo_nome,
  });

  const baseScript = suggestions[0]?.texto || '';

  // ——— APENAS Motor Lexis: script fixo
  if (isLocalOnly(preferredModel)) {
    return {
      sucesso: true,
      rascunho: cleanBannedTerms(baseScript),
      engine: 'MOTOR_LEXIS_SCRIPTS',
      engineUtilizada: 'MOTOR_LEXIS_SCRIPTS',
    };
  }

  // ——— IA externa: LIVRE (não forçar script)
  const keywords = [
    String(eventoTipo || ''),
    ...(movimentos[0]?.nome?.split(' ') || []),
  ].slice(0, 8);

  let contextKnowledge = '';
  try {
    const staticChunks = retrieveKnowledge(keywords);
    let dynamicChunks: any[] = [];
    if (empresaId) {
      const dbRes = await searchKnowledgeChunksAction(keywords, empresaId);
      if (dbRes.success) dynamicChunks = dbRes.chunks || [];
    }
    const allChunks = [...staticChunks, ...dynamicChunks].slice(0, 5);
    contextKnowledge = allChunks.map((c) => c.texto).join('\n\n');
  } catch {
    // knowledge opcional
  }

  const historicoTxt = (movimentos || [])
    .slice(0, 25)
    .map((m: any) => {
      const bits = [m.dataHora, m.nome, m.complemento, m.descricao].filter(Boolean);
      return `- ${bits.join(' | ')}`;
    })
    .join('\n');

  const djenBlock =
    djenTexts.length > 0
      ? `\nPUBLICAÇÕES DJEN (texto limpo):\n${djenTexts.slice(0, 8).join('\n---\n')}`
      : '';

  const systemPrompt = `Você é um assistente de back-office jurídico brasileiro, experiente e cuidadoso.
Escreva UMA mensagem de WhatsApp/e-mail para o CLIENTE (pessoa leiga), em português claro, sem juridiquês desnecessário.

REGRAS DE OURO (obrigatórias):
1. NÃO invente valores de custas. R$ que for RENDA, salário, cônjuge, faturamento NÃO é custas.
2. Identifique QUEM deve pagar: se a intimação é à "parte requerida", "réu" ou "banco", a cobrança NÃO é do cliente.
3. Se o cliente tem justiça gratuita (AJG), diga que em regra está isento de custas.
4. Cancelamento da distribuição (art. 290) / extinção sem mérito por falta de custas INICIAIS = processo baixado; NÃO invente dívida absurda nem Dívida Ativa sem texto claro de intimação residual ao autor.
5. Cumprimento de sentença iniciado / intimação ao executado = boa notícia para o autor; não assuste com cobrança dele.
6. Nunca diga "não precisa fazer nada" se houver intimação de pagamento REAL ao autor.
7. Nunca cite nomes de escritórios/marcas; use "nossa equipe" / "nosso escritório".
8. Seja preciso: extinção sem mérito ≠ julgamento do mérito.

Base auxiliar (opcional, não invente além do histórico):
${contextKnowledge || '(sem base extra)'}
`;

  const userPrompt = `PROCESSO: ${protocolo}
CLIENTE (autor/polo ativo típico): ${clienteNome}
EVENTO: ${eventoTipo || 'N/A'} — ${eventoResumo || 'N/A'}
FLAGS: BA=${!!indicio_busca_apreensao} ENCERRADO=${!!datajud_encerrado_tribunal} CUMPRIMENTO=${!!em_cumprimento_sentenca} NOVIDADE=${!!tem_novo_andamento}

CRONOLOGIA / MOVIMENTOS:
${historicoTxt || '(sem movimentos detalhados)'}
${djenBlock}

Redija a mensagem final ao cliente, honesta e tranquilizadora quando for o caso, urgente só se a cobrança for dele de verdade.`;

  try {
    const response = await perguntarIA({
      pergunta: userPrompt,
      historico: [{ role: 'system', content: systemPrompt }],
      preferredModel: preferredModel || 'xai',
    });

    const engine =
      (response as any).engineUtilizada ||
      (response as any).engine ||
      preferredModel ||
      'IA';

    return {
      sucesso: true,
      rascunho: cleanBannedTerms(
        (response as any).resposta || (response as any).texto || baseScript
      ),
      engine,
      engineUtilizada: engine,
    };
  } catch (error) {
    // Fallback só se a IA falhar: script Lexis
    return {
      sucesso: false,
      rascunho: cleanBannedTerms(baseScript),
      engine: 'LOCAL_FALLBACK_SCRIPT',
      engineUtilizada: 'LOCAL_FALLBACK_SCRIPT',
    };
  }
}

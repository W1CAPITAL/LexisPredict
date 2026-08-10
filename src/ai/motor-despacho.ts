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
  preferredModel?: string; // 'claude' | 'groq-llama' | 'local_only' | ...
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
    .slice(0, 12)
    .map((m: any) => {
      const bits = [m.dataHora, m.nome, m.complemento, m.descricao].filter(Boolean);
      return `- ${bits.join(' | ')}`;
    })
    .join('\n');

  const djenBlock =
    djenTexts.length > 0
      ? `\nPUBLICAÇÕES DJEN (texto limpo):\n${djenTexts.slice(0, 8).join('\n---\n')}`
      : '';

  const systemPrompt = `Você é redator de atendimento processual (WhatsApp) para assessoria jurídica brasileira.
Escreva UMA mensagem curta ao CLIENTE leigo. Português claro.

REGRAS OBRIGATÓRIAS:
1. Use SOMENTE fatos do histórico/DJEN abaixo. NÃO invente andamento, valor, prazo ou resultado.
2. R$ de renda/salário/cônjuge NÃO é custas. Só fale valor de custas se o texto ligar a taxa/guia/UFESP e disser quem paga.
3. Se a intimação for ao réu/banco/requerido, diga que a cobrança NÃO é do cliente.
4. AJG do autor → cliente em regra isento de custas.
5. "Sob pena de cancelamento" ≠ cancelamento já feito. Se o despacho só ameaça cancelar se não pagar custas, diga que HÁ PRAZO e oriente a regularizar — não diga que o processo já foi baixado.
6. Cancelamento/extinção só se o texto disser que a distribuição FOI cancelada / processo extinto / baixa definitiva após isso.
7. NUNCA mencione busca e apreensão, veículo ou mandado se isso não estiver explícito nos movimentos/DJEN deste processo (ignore jurisprudência citada).
8. Cumprimento de sentença / intimação ao executado = atualização positiva para o autor.
9. Nunca cite marcas de escritório; use "nossa equipe".
10. Tom: objetivo, 6–12 linhas. Sem juridiquês vazio. Sem "como IA".
11. Se o histórico for insuficiente, diga que a equipe está analisando — não complete com suposição.
12. PRIORIDADE TEMPORAL: use SEMPRE o evento mais recente com mérito (decisão, intimação com prazo, extinção, petição de cumprimento). Ignore despachos antigos já superados por intimação/petição posterior.
13. Justiça gratuita / emenda / Registrato: se houver despacho pedindo documentos E petição posterior da equipe, diga que a pendência foi tratada / protocolo realizado — NÃO reabra a lista completa de documentos do despacho antigo.
14. Se o prazo final de intimação já passou e há petição recente, foque no status "aguardando juízo", não em "envie documentos agora".
15. Mensagem curta (WhatsApp): 6–10 linhas, tom de equipe, sem "Prezado", sem inventar que o cliente precisa agir se a equipe já protocolou.

Script de apoio (pode inspirar o tom, não copie se contradizer o histórico):
${baseScript ? baseScript.slice(0, 800) : '(nenhum)'}

Base auxiliar:
${contextKnowledge || '(sem base extra)'}
`;

  const userPrompt = `PROCESSO: ${protocolo}
CLIENTE (autor/polo ativo típico): ${clienteNome}
EVENTO: ${eventoTipo || 'N/A'} — ${eventoResumo || 'N/A'}
FLAGS: ENCERRADO=${!!datajud_encerrado_tribunal} CUMPRIMENTO=${!!em_cumprimento_sentenca} NOVIDADE=${!!tem_novo_andamento}\n(IGNORE qualquer tag B.A. da interface; só use o histórico abaixo.)

CRONOLOGIA / MOVIMENTOS (já priorize o MAIS RECENTE):
${historicoTxt || '(sem movimentos detalhados)'}

Lembrete: o evento no TOPO da lista (data mais nova) manda na mensagem. Não resuma só o despacho de maio se existir intimação/petição em julho/agosto.
${djenBlock}

Redija a mensagem final ao cliente, honesta e tranquilizadora quando for o caso, urgente só se a cobrança for dele de verdade.`;

  try {
    const response = await perguntarIA({
      pergunta: userPrompt,
      historico: [{ role: 'system', content: systemPrompt }],
      preferredModel: preferredModel || 'auto',
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

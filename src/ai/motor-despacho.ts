/**
 * MOTOR LEXIS DE DESPACHO v11.0
 * Núcleo unificado: scripts determinísticos + IA (API) com âncora de fidelidade.
 * Usado por Tarefas e Processos.
 */
'use server';

import { perguntarIA } from '@/ai/flows/chat-ai-flow';
import { suggestScripts, ScriptSuggestion, ScriptInput } from '@/lib/script-processual/suggest';
import { retrieveKnowledge } from '@/lib/knowledge/retrieve';
import { searchKnowledgeChunksAction } from '@/app/actions/knowledge-actions';
import { EventoTipo } from '@/lib/case-logic';

export interface MotorDespachoInput {
  clienteNome: string;
  protocolo: string;
  ultimoRetorno?: string | null;
  movimentos: any[];
  djenTexts?: string[];
  eventoTipo?: EventoTipo | string | null;
  eventoResumo?: string | null;
  preferredModel?: string;
  empresaId?: string;
  tem_novo_andamento?: boolean;
  tem_atualizacao_pos_retorno?: boolean;
  djen_nova_comunicacao?: boolean;
  datajud_encerrado_tribunal?: boolean;
  indicio_busca_apreensao?: boolean;
  em_cumprimento_sentenca?: boolean;
  datajud_ultimo_nome?: string | null;
  djen_ultimo_resumo?: string | null;
}

const BANNED_TERMS = [
  'GET ASSESSORIA',
  'GETASSESSORIA',
  'W1 CAPITAL',
  'W1CAPITAL',
  'W1 CAP',
  'DAVI ALVES',
  'FIGUEREDO',
  'W1CAP',
  'ASSECOM',
  'LEXISPREDICT',
];

function cleanBannedTerms(text: string): string {
  let cleaned = text || '';
  BANNED_TERMS.forEach((term) => {
    const regex = new RegExp(term.replace(/\s+/g, '\\s*'), 'gi');
    cleaned = cleaned.replace(regex, 'nosso escritório');
  });
  // remove "W1" isolado residual
  cleaned = cleaned.replace(/\bW1\b/gi, 'nosso escritório');
  cleaned = cleaned.replace(/\bGET\b/gi, 'nosso escritório');
  return cleaned.replace(/\s{2,}/g, ' ').trim();
}

function toScriptInput(input: MotorDespachoInput): ScriptInput {
  return {
    clienteNome: input.clienteNome,
    protocolo: input.protocolo,
    ultimoRetorno: input.ultimoRetorno,
    movimentos: input.movimentos || [],
    djenTexts: input.djenTexts || [],
    eventoTipo: input.eventoTipo as any,
    eventoResumo: input.eventoResumo,
    tem_novo_andamento: input.tem_novo_andamento,
    tem_atualizacao_pos_retorno: input.tem_atualizacao_pos_retorno,
    djen_nova_comunicacao: input.djen_nova_comunicacao,
    datajud_encerrado_tribunal: input.datajud_encerrado_tribunal,
    indicio_busca_apreensao: input.indicio_busca_apreensao,
    em_cumprimento_sentenca: input.em_cumprimento_sentenca,
    datajud_ultimo_nome: input.datajud_ultimo_nome,
    djen_ultimo_resumo: input.djen_ultimo_resumo,
  };
}

/**
 * Sempre devolve scripts ranqueados (mesmo núcleo de Tarefas/Processos).
 */
export async function gerarSugestoesCliente(input: MotorDespachoInput): Promise<{
  sucesso: boolean;
  suggestions: ScriptSuggestion[];
  engine: string;
}> {
  const suggestions = suggestScripts(toScriptInput(input));
  return {
    sucesso: true,
    suggestions: suggestions.map((s) => ({ ...s, texto: cleanBannedTerms(s.texto) })),
    engine: 'MOTOR_LEXIS_SCRIPTS_v11',
  };
}

/**
 * Rascunho estratégico: local_only = melhor script; API = IA ancorada no script + flags.
 */
export async function gerarRascunhoEstrategico(input: MotorDespachoInput) {
  const {
    clienteNome,
    protocolo,
    movimentos = [],
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

  const { suggestions } = await gerarSugestoesCliente(input);
  const baseScript = suggestions[0]?.texto || '';
  const categoria = suggestions[0]?.categoria || 'geral';

  if (!preferredModel || preferredModel === 'local_only') {
    return {
      sucesso: true,
      rascunho: cleanBannedTerms(baseScript),
      suggestions,
      engine: 'MOTOR_LEXIS_SOBERANO_v11',
    };
  }

  const keywords = [categoria, ...(movimentos[0]?.nome?.split(' ') || [])].filter(Boolean).slice(0, 8);
  const staticChunks = retrieveKnowledge(keywords);

  let dynamicChunks: any[] = [];
  if (empresaId) {
    try {
      const dbRes = await searchKnowledgeChunksAction(keywords, empresaId);
      if (dbRes.success) dynamicChunks = dbRes.chunks || [];
    } catch {
      /* */
    }
  }

  const allChunks = [...staticChunks, ...dynamicChunks].slice(0, 5);
  const contextKnowledge = allChunks.map((c) => `[REGRA]: ${c.texto}`).join('\n\n');

  const systemPrompt = `Você é o redator de atendimento do setor processual (WhatsApp/e-mail ao cliente).

REGRAS INVIOLÁVEIS:
1. Nunca invente decisão, valor, prazo ou resultado que não esteja nos dados.
2. Nunca cite nome de empresa, marca, assessoria ou pessoa interna. Use "nossa equipe" ou "setor processual".
3. Tom: brasileiro, claro, empático, profissional, 4–7 linhas no máximo.
4. Se houver BUSCA E APREENSÃO: urgência + resguardar o bem + equipe já analisando.
5. Se houver TRÂNSITO/BAIXA: informar validação do teor; não prometer dinheiro nem arquivamento interno.
6. Se IMPROCEDENTE ou reforma desfavorável: seja transparente, sem dramatizar; diga que a equipe analisa medidas cabíveis.
7. Se só houver novidade genérica: diga que há movimentação e que retornam após leitura — sem conclusão.
8. Use o PRIMEIRO NOME do cliente e o CNJ exatamente como informado.
9. Estrutura: saudação → fato → o que a equipe está fazendo → próximo passo / canal.

BASE DE CONHECIMENTO (opcional):
${contextKnowledge || '(nenhuma regra extra)'}

ÂNCORA DETERMINÍSTICA (use como base e refine, não contradiga):
"""${baseScript}"""
`;

  const djenContext =
    djenTexts.length > 0 ? `\nPUBLICAÇÕES DJEN:\n${djenTexts.slice(0, 3).join('\n---\n')}` : '';

  const userPrompt = `CLIENTE: ${clienteNome}
PROTOCOLO: ${protocolo}
EVENTO: ${eventoTipo || 'N/A'} | ${eventoResumo || 'N/A'}
FLAGS: BA=${!!indicio_busca_apreensao} BAIXA=${!!datajud_encerrado_tribunal} NOVIDADE=${!!tem_novo_andamento} CUMPRIMENTO=${!!em_cumprimento_sentenca}
ÚLTIMO RETORNO: ${input.ultimoRetorno || '—'}
MOVIMENTOS:
${movimentos
  .slice(0, 12)
  .map((m) => `- ${m.dataHora || ''}: ${m.nome || ''} ${m.complemento || ''}`)
  .join('\n')}
${djenContext}

Redija UMA mensagem pronta para copiar ao cliente.`;

  try {
    const response = await perguntarIA({
      pergunta: userPrompt,
      historico: [{ role: 'system', content: systemPrompt }],
      preferredModel: preferredModel || 'xai',
    });

    return {
      sucesso: true,
      rascunho: cleanBannedTerms(response.resposta),
      suggestions,
      engine: response.engineUtilizada || preferredModel,
    };
  } catch {
    return {
      sucesso: true,
      rascunho: cleanBannedTerms(baseScript),
      suggestions,
      engine: 'LOCAL_FALLBACK_v11',
    };
  }
}

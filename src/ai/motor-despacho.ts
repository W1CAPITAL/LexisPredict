/**
 * @fileOverview MOTOR LEXIS DE DESPACHO v10.0 (FIDELIDADE DE MÉRITO + PROTEÇÃO ANTI-ALUCINAÇÃO)
 * Orquestrador principal que prioriza Base de Conhecimento e garante verdade processual absoluta.
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
  preferredModel?: string; // 'xai' | 'groq-llama' | 'local_only'
  empresaId?: string;
}

const BANNED_TERMS = [
  'GET ASSESSORIA', 'GETASSESSORIA', 'W1 CAPITAL', 'W1CAPITAL', 
  'W1', 'GET', 'DAVI ALVES', 'FIGUEREDO', 'W1CAP'
];

/**
 * Filtro de Segurança: Garante anonimização e evita termos de vitória em ritos de perda.
 */
function cleanBannedTerms(text: string): string {
  let cleaned = text;
  BANNED_TERMS.forEach(term => {
    const regex = new RegExp(`\\b${term}\\b`, 'gi');
    cleaned = cleaned.replace(regex, 'nosso escritório');
  });
  return cleaned;
}

/**
 * Gera um rascunho estratégico utilizando o Core Lexis (RAG + Fidelidade de Mérito).
 */
export async function gerarRascunhoEstrategico(input: MotorDespachoInput) {
  const { clienteNome, protocolo, movimentos, djenTexts = [], eventoTipo, eventoResumo, preferredModel, empresaId } = input;

  const suggestions = suggestScripts({
    clienteNome,
    protocolo,
    ultimoRetorno: input.ultimoRetorno,
    movimentos,
    djenTexts,
    eventoTipo,
    eventoResumo
  });

  const baseScript = suggestions[0]?.texto || "";
  const categoria = suggestions[0]?.categoria || "geral";

  // MODO DETERMINÍSTICO (LOCAL ONLY)
  if (preferredModel === 'local_only') {
    return {
      sucesso: true,
      rascunho: cleanBannedTerms(baseScript),
      engine: "MOTOR_LEXIS_SOBERANO"
    };
  }

  const keywords = [categoria, ...(movimentos[0]?.nome?.split(' ') || [])].slice(0, 8);
  const staticChunks = retrieveKnowledge(keywords);
  
  let dynamicChunks: any[] = [];
  if (empresaId) {
    const dbRes = await searchKnowledgeChunksAction(keywords, empresaId);
    if (dbRes.success) dynamicChunks = dbRes.chunks || [];
  }

  const allChunks = [...staticChunks, ...dynamicChunks].slice(0, 5);
  const contextKnowledge = allChunks.map(c => `[REGRA OFICIAL]: ${c.texto}`).join('\n\n');

  const systemPrompt = `
    VOCÊ É O MOTOR DE RASCUNHO LEXIS CORE v10.0.
    MISSÃO: REDIGIR ATENDIMENTO TRANSPARENTE, PROFISSIONAL E FINANCEIRAMENTE SEGURO.
    
    DIRETRIZES CRÍTICAS DE FIDELIDADE:
    1. REVERSÃO DE MÉRITO (ATENÇÃO MÁXIMA): Se o histórico recente contém 'PROVIMENTO AO RECURSO DO RÉU' ou 'REFORMA DA SENTENÇA' após uma vitória anterior, você DEVE informar que a decisão foi alterada e que o cliente perdeu a causa em segunda instância. Nunca diga que é uma "atualização de rotina".
    2. INDEFERIMENTO DA INICIAL: Se o histórico indica que a petição inicial foi indeferida ou o processo foi extinto logo no início, explique que o juiz abortou o caso por falta de requisito formal (sem julgar o mérito). 
    3. IMUNIDADE FINANCEIRA: Se a inicial foi indeferida ou se a Gratuidade foi deferida, você DEVE cravar que o cliente está ISENTO de qualquer custo, honorário ou taxa. Afirme que o risco é ZERO.
    4. GRATUIDADE DE JUSTIÇA: Se o histórico indica que a gratuidade foi deferida, você DEVE mencionar que a cobrança de honorários sucumbenciais está SUSPENSA.
    5. VALORES DE HONORÁRIOS: Nunca invente percentuais se não estiverem explícitos no movimento atual.
    6. PROIBIÇÃO: Nunca cite nome de empresa ou marca. Use "Setor Processual" ou "nosso escritório".
    
    ESTRUTURA OBRIGATÓRIA: Contexto -> Fato Leigo -> Impacto (Financeiro) -> Próximo Passo.
    
    BASE DE CONHECIMENTO AUTORIZADA:
    ${contextKnowledge}
  `;

  const djenContext = djenTexts.length > 0 ? `\nPUBLICAÇÕES DJEN (LIMPIDAS):\n${djenTexts.join('\n')}` : "";

  const userPrompt = `
    DADOS DO PROCESSO: ${protocolo}
    CLIENTE: ${clienteNome}
    EVENTO UNIFICADO: ${eventoTipo || 'N/A'} - ${eventoResumo || 'N/A'}
    HISTÓRICO RECENTE DO TRIBUNAL (ORDEM CRONOLÓGICA):
    ${movimentos.slice(0, 15).map(m => `- ${m.dataHora}: ${m.nome} | ${m.complemento || ''}`).join('\n')}
    ${djenContext}
    
    SCRIPT BASE SUGERIDO:
    "${baseScript}"
    
    TAREFA: REDIGIR RASCUNHO FINAL RESPEITANDO A FIDELIDADE DA DECISÃO E A IMUNIDADE FINANCEIRA (AJG):
  `;

  try {
    const response = await perguntarIA({
      pergunta: userPrompt,
      historico: [{ role: 'system', content: systemPrompt }],
      preferredModel: preferredModel || 'xai'
    });

    return {
      sucesso: true,
      rascunho: cleanBannedTerms(response.resposta),
      engine: response.engineUtilizada
    };
  } catch (error) {
    return {
      sucesso: false,
      rascunho: cleanBannedTerms(baseScript),
      engine: "LOCAL_DETERMINISTIC"
    };
  }
}
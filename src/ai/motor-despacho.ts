/**
 * @fileOverview MOTOR LEXIS DE DESPACHO v8.5 (FIDELIDADE DE MÉRITO + PROTEÇÃO DE PASSIVO)
 * Orquestrador principal que prioriza Base de Conhecimento e garante verdade processual.
 * @copyright 2026 Davi Alves Figueredo / W1 Capital Assessoria Financeira Ltda.
 */

import { perguntarIA } from '@/ai/flows/chat-ai-flow';
import { suggestScripts } from '@/lib/script-processual/suggest';
import { retrieveKnowledge } from '@/lib/knowledge/retrieve';
import { searchKnowledgeChunksAction } from '@/app/actions/knowledge-actions';

export interface MotorDespachoInput {
  clienteNome: string;
  protocolo: string;
  ultimoRetorno?: string | null;
  movimentos: any[];
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
  const { clienteNome, protocolo, movimentos, preferredModel, empresaId } = input;

  const suggestions = suggestScripts({
    clienteNome,
    protocolo,
    ultimoRetorno: input.ultimoRetorno,
    movimentos
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
    VOCÊ É O MOTOR DE RASCUNHO LEXIS CORE v8.5.
    MISSÃO: REDIGIR ATENDIMENTO TRANSPARENTE, PROFISSIONAL E FINANCEIRAMENTE SEGURO.
    
    DIRETRIZES CRÍTICAS DE FIDELIDADE:
    1. GRATUIDADE DE JUSTIÇA: Se o histórico indica que a gratuidade foi deferida, você DEVE mencionar que a cobrança de honorários sucumbenciais está SUSPENSA. Isso evita pânico financeiro desnecessário no cliente.
    2. VALORES DE HONORÁRIOS: Nunca invente percentuais (como 15%) se não estiverem explícitos no movimento atual. Use termos como "conforme determinado pelo juízo".
    3. SE O PROCESSO FOI ENCERRADO: Explique o motivo real. Se foi perda, não use tom de sucesso. Se tem JG, foque na suspensão da dívida.
    4. PROIBIÇÃO: Nunca cite nome de empresa ou marca. Use "Setor Processual".
    
    BASE DE CONHECIMENTO AUTORIZADA:
    ${contextKnowledge}
  `;

  const userPrompt = `
    DADOS DO PROCESSO: ${protocolo}
    HISTÓRICO RECENTE DO TRIBUNAL:
    ${movimentos.slice(0, 15).map(m => `- ${m.dataHora}: ${m.nome} | ${m.complemento || ''}`).join('\n')}
    
    SCRIPT BASE SUGERIDO:
    "${baseScript}"
    
    REDIGIR RASCUNHO FINAL RESPEITANDO A GRATUIDADE E A VERDADE DA DECISÃO:
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

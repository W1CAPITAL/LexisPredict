/**
 * @fileOverview MOTOR LEXIS DE DESPACHO v8.0 (FIDELIDADE DE MÉRITO + SOBERANIA LOCAL)
 * Orquestrador principal que prioriza Base de Conhecimento e permite rascunho determinístico.
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
    VOCÊ É O MOTOR DE RASCUNHO LEXIS CORE v8.0.
    MISSÃO: REDIGIR ATENDIMENTO TRANSPARENTE E PROFISSIONAL.
    
    DIRETRIZES CRÍTICAS DE FIDELIDADE:
    1. SE O PROCESSO FOI ENCERRADO/CANCELADO: Explique o motivo real (ex: falta de custas, indeferimento). NUNCA use tom de comemoração se houve derrota ou falha técnica.
    2. PASSIVO FINANCEIRO: Se houver majoração de honorários de sucumbência ou custas pendentes, ALERTE o cliente sobre este passivo.
    3. ESTRUTURA: Contexto -> Fato Real -> Impacto (Ganhos ou Perdas) -> Próximo Passo.
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
    
    REDIGIR RASCUNHO FINAL COM FOCO NA VERDADE DA DECISÃO:
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

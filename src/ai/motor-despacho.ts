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
  // Flags de sinal unificado
  tem_novo_andamento?: boolean;
  datajud_encerrado_tribunal?: boolean;
  indicio_busca_apreensao?: boolean;
  em_cumprimento_sentenca?: boolean;
}

const BANNED_TERMS = [
  'GET ASSESSORIA', 'GETASSESSORIA', 'W1 CAPITAL', 'W1CAPITAL', 
  'W1', 'GET', 'DAVI ALVES', 'FIGUEREDO', 'W1CAP', 'ASSECOM'
];

/**
 * Filtro de Segurança: Garante anonimização e evita termos de marca em mensagens institucionais.
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
  const { 
    clienteNome, protocolo, movimentos, djenTexts = [], 
    eventoTipo, eventoResumo, preferredModel, empresaId,
    tem_novo_andamento, datajud_encerrado_tribunal, indicio_busca_apreensao, em_cumprimento_sentenca
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
    em_cumprimento_sentenca
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
    1. REVERSÃO DE MÉRITO (ATENÇÃO MÁXIMA): Se o histórico contém 'PROVIMENTO AO RECURSO DO RÉU' ou 'REFORMA DA SENTENÇA', você DEVE informar que a decisão foi alterada e que o cliente perdeu a causa.
    2. ENCERRAMENTO NO TRIBUNAL: Se houver indício de trânsito ou baixa, informe que o caso atingiu o fim e a equipe está confirmando.
    3. BUSCA E APREENSÃO: Trate com máxima urgência; peça para resguardar o bem.
    4. JUSTIÇA GRATUITA (AJG): Se deferida, reforce que o cliente está ISENTO de custas/honorários.
    5. PROIBIÇÃO ABSOLUTA: Nunca cite nome de empresa ou marca. Use "Setor Processual" ou "nosso escritório".
    6. SEM INVENÇÃO: Se não houver clareza sobre o mérito, diga apenas que houve novidade e estamos analisando.
    
    ESTRUTURA OBRIGATÓRIA: Contexto -> Fato Simples (conforme input) -> Impacto Seguro -> Próximo Passo.
    
    BASE DE CONHECIMENTO AUTORIZADA:
    ${contextKnowledge}
  `;

  const djenContext = djenTexts.length > 0 ? `\nPUBLICAÇÕES DIÁRIO OFICIAL (LIMPAS):\n${djenTexts.join('\n')}` : "";

  const userPrompt = `
    DADOS DO PROCESSO: ${protocolo}
    CLIENTE: ${clienteNome}
    EVENTO UNIFICADO: ${eventoTipo || 'N/A'} - ${eventoResumo || 'N/A'}
    FLAGS: BA=${!!indicio_busca_apreensao}, BAIXA=${!!datajud_encerrado_tribunal}, NOVIDADE=${!!tem_novo_andamento}
    HISTÓRICO RECENTE (CRONOLÓGICO):
    ${movimentos.slice(0, 15).map(m => `- ${m.dataHora}: ${m.nome}`).join('\n')}
    ${djenContext}
    
    TAREFA: REDIGIR RASCUNHO FINAL RESPEITANDO A FIDELIDADE DA DECISÃO E O SIGILO DA MARCA:
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

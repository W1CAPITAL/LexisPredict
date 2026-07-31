/**
 * @fileOverview MOTOR LEXIS DE DESPACHO v6.0 (CORE SOBERANO)
 * Orquestrador principal que prioriza Base de Conhecimento Local e aplica Anonimização.
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
  preferredModel?: string;
  empresaId?: string;
}

const BANNED_TERMS = [
  'GET ASSESSORIA', 'GETASSESSORIA', 'W1 CAPITAL', 'W1CAPITAL', 
  'W1', 'GET', 'DAVI ALVES', 'FIGUEREDO', 'W1CAP'
];

/**
 * Filtro de Segurança: Garante que NENHUM nome de empresa saia no rascunho.
 */
function cleanBannedTerms(text: string): string {
  let cleaned = text;
  BANNED_TERMS.forEach(term => {
    const regex = new RegExp(`\\b${term}\\b`, 'gi');
    cleaned = cleaned.replace(regex, 'nosso escritório');
  });
  
  // Limpeza extra para ritos de apresentação
  cleaned = cleaned.replace(/pela nossa assessoria/gi, 'pelo nosso setor processual');
  cleaned = cleaned.replace(/da Get/gi, 'do nosso jurídico');
  
  return cleaned;
}

/**
 * Gera um rascunho estratégico utilizando o Core Lexis (RAG + Prompt Grounding).
 */
export async function gerarRascunhoEstrategico(input: MotorDespachoInput) {
  const { clienteNome, protocolo, movimentos, preferredModel, empresaId } = input;

  // 1. Obter Sugestão Determinística (Baseline)
  const suggestions = suggestScripts({
    clienteNome,
    protocolo,
    ultimoRetorno: input.ultimoRetorno,
    movimentos
  });

  const baseScript = suggestions[0]?.texto || "";
  const categoria = suggestions[0]?.categoria || "geral";

  // 2. Recuperação de Conhecimento (RAG Local)
  const keywords = [categoria, ...(movimentos[0]?.nome?.split(' ') || [])].slice(0, 8);
  
  // A. Conhecimento Global (Manual da Get)
  const staticChunks = retrieveKnowledge(keywords);
  
  // B. Conhecimento Dinâmico (PDFs da Empresa no Supabase)
  let dynamicChunks: any[] = [];
  if (empresaId) {
    const dbRes = await searchKnowledgeChunksAction(keywords, empresaId);
    if (dbRes.success) dynamicChunks = dbRes.chunks || [];
  }

  const allChunks = [...staticChunks, ...dynamicChunks].slice(0, 5);
  const contextKnowledge = allChunks.map(c => `[REGRA OFICIAL]: ${c.texto}`).join('\n\n');

  // 3. System Prompt Soberano (GROUNDED)
  const systemPrompt = `
    VOCÊ É O MOTOR DE RASCUNHO LEXIS CORE v6.0.
    SUA MISSÃO: REDIGIR ATENDIMENTO PROCESSUAL PROFISSIONAL PARA O CLIENTE ${clienteNome.toUpperCase()}.
    
    FONTES DE VERDADE:
    - Movimentos reais do tribunal (DataJud).
    - Base de Conhecimento anexa (Siga estas regras rigorosamente).
    
    DIRETRIZES CRÍTICAS:
    - ESTRUTURA: Contexto -> Fato Leigo -> Impacto Seguro -> Próximo Passo.
    - TOM: Profissional, calmo, sem "juridiquês" excessivo.
    - PROIBIÇÃO: NUNCA cite nome de empresa, marca, razão social ou fundador. 
    - SEGURANÇA: Se o processo foi encerrado/cancelado, explique o motivo técnico de forma honesta. Não use tom de vitória se houve cancelamento.
    - PAGAMENTOS: Se o assunto envolver custas, reforce que boletos são apenas oficiais do Tribunal ou via CNPJ da assessoria. Jamais em nome de pessoa física.
    
    TRECHOS AUTORIZADOS DA BASE DE CONHECIMENTO:
    ${contextKnowledge}
  `;

  const userPrompt = `
    DADOS DO PROCESSO: ${protocolo}
    ÚLTIMO RETORNO: ${input.ultimoRetorno || 'Não registrado'}
    MOVIMENTAÇÃO RECENTE:
    ${movimentos.slice(0, 5).map(m => `- ${m.dataHora}: ${m.nome}`).join('\n')}
    
    SCRIPT BASE (Sugerido pelo Motor Local):
    "${baseScript}"
    
    REDIGIR RASCUNHO FINAL (SIGA A ESTRUTURA):
  `;

  try {
    const response = await perguntarIA({
      pergunta: userPrompt,
      historico: [{ role: 'system', content: systemPrompt }],
      preferredModel: preferredModel || 'xai'
    });

    const finalDraft = cleanBannedTerms(response.resposta);

    return {
      sucesso: true,
      rascunho: finalDraft,
      engine: response.engineUtilizada,
      chunks: allChunks.length,
      isGrounded: allChunks.length > 0
    };
  } catch (error) {
    // Fallback absoluto: Script Local Determinístico com Anonimização
    return {
      sucesso: false,
      rascunho: cleanBannedTerms(baseScript),
      engine: "LOCAL_DETERMINISTIC",
      chunks: 0,
      isGrounded: false
    };
  }
}

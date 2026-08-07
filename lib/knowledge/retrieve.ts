
/**
 * @fileOverview Mecanismo de Recuperação de Conhecimento (RAG Local) v1.0
 * Busca trechos do manual oficial baseando-se em tags e keywords do movimento.
 * @copyright 2026 Davi Alves Figueredo / W1 Capital Assessoria Financeira Ltda.
 */

import knowledgeBase from './index.json';

export interface KnowledgeChunk {
  id: string;
  secao: string;
  tags: string[];
  texto: string;
}

/**
 * Recupera os chunks mais relevantes para o contexto atual.
 */
export function retrieveKnowledge(keywords: string[]): KnowledgeChunk[] {
  const allChunks = (knowledgeBase.chunks as KnowledgeChunk[]) || [];
  const matches: { chunk: KnowledgeChunk; score: number }[] = [];

  const upperKeywords = keywords.map(k => k.toUpperCase());

  allChunks.forEach(chunk => {
    let score = 0;
    
    // Match por Tags
    chunk.tags.forEach(tag => {
      if (upperKeywords.some(kw => kw.includes(tag.toUpperCase()) || tag.toUpperCase().includes(kw))) {
        score += 10;
      }
    });

    // Match por Título da Seção
    if (upperKeywords.some(kw => chunk.secao.toUpperCase().includes(kw))) {
      score += 5;
    }

    if (score > 0) {
      matches.push({ chunk, score });
    }
  });

  return matches
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map(m => m.chunk);
}

/**
 * @copyright 2026 Davi Alves Figueredo / W1 Capital Assessoria Financeira Ltda.
 * @fileOverview Gestor de Memória de Curto Prazo.
 */

import { ChatMessage } from './types';

export function optimizeHistory(history: ChatMessage[], maxMessages: number = 6): ChatMessage[] {
  if (history.length <= maxMessages) return history;
  
  console.log(`[MEMORY] Reduzindo histórico de ${history.length} para ${maxMessages} mensagens.`);
  
  // Mantém as primeiras 2 (geralmente system/context) e as últimas 4
  const start = history.slice(0, 2);
  const end = history.slice(-maxMessages + 2);
  
  return [...start, ...end];
}

/**
 * @copyright 2026 Davi Alves Figueredo / W1 Capital Assessoria Financeira Ltda.
 * @fileOverview Tipagem Centralizada para o Ecossistema de IA.
 */

export type AIProvider = 'xai' | 'groq' | 'airforce' | 'system';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface AIRequest {
  message: string;
  history?: ChatMessage[];
  preferredProvider?: AIProvider;
  temperature?: number;
  responseFormat?: 'text' | 'json';
  contextType?: 'general' | 'legal' | 'whatsapp' | 'verdict' | 'contract_audit' | 'case_swot' | 'peca' | 'extract';
}

export interface AIResponse {
  success: boolean;
  content: string;
  provider: AIProvider;
  model: string;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  metrics: {
    durationMs: number;
    attempts: number;
  };
  error?: string;
}

export interface AIContext {
  empresa: any;
  user: any;
  cases: any[];
  notes: any[];
  stats: any;
}

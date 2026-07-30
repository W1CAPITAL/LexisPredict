/**
 * @fileOverview Interpretador Neural de Movimentações MNI
 */

import { MovimentoNacional } from '../types/dto';

export type AICategory = 
  | 'SENTENÇA' | 'TRÂNSITO EM JULGADO' | 'BAIXA DEFINITIVA' 
  | 'ARQUIVAMENTO' | 'PETIÇÃO' | 'DESPACHO' | 'LIMINAR' 
  | 'AUDIÊNCIA' | 'CUMPRIMENTO DE SENTENÇA' | 'OUTROS';

export interface AIAnalysis {
  categoria: AICategory;
  criticidade: 'BAIXA' | 'MÉDIA' | 'ALTA' | 'MÁXIMA';
  prioridade: number;
  risco: string;
  acaoSugerida: string;
}

export class MovimentacaoAI {
  static analisar(mov: MovimentoNacional): AIAnalysis {
    const text = mov.descricao.toUpperCase();
    
    if (text.includes('BAIXA DEFINITIVA')) {
      return { categoria: 'BAIXA DEFINITIVA', criticidade: 'ALTA', prioridade: 1, risco: 'Nenhum', acaoSugerida: 'Arquivar pasta interna.' };
    }
    
    if (text.includes('SENTENÇA') || text.includes('JULGADO')) {
      return { categoria: 'SENTENÇA', criticidade: 'MÁXIMA', prioridade: 0, risco: 'Alto', acaoSugerida: 'Revisar prazo recursal urgente.' };
    }
    
    if (text.includes('AUDIÊNCIA')) {
      return { categoria: 'AUDIÊNCIA', criticidade: 'ALTA', prioridade: 1, risco: 'Médio', acaoSugerida: 'Preparar testemunhas e preposto.' };
    }

    return {
      categoria: 'OUTROS',
      criticidade: 'BAIXA',
      prioridade: 3,
      risco: 'Monitoramento',
      acaoSugerida: 'Acompanhar andamento.'
    };
  }
}

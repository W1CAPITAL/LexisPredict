/**
 * @fileOverview Interpretador Neural de Movimentações MNI v5.0
 * Classificação estrita conforme regras de Gabinete W1 Capital.
 */

import { MovimentoNacional } from '../types/dto';
import { EncerramentoDetector } from './encerramento-detector';

export type AICategory = 
  | 'SENTENÇA'
  | 'DESPACHO'
  | 'DECISÃO'
  | 'PUBLICAÇÃO'
  | 'PETIÇÃO'
  | 'RECURSO'
  | 'CONCLUSÃO'
  | 'AUDIÊNCIA'
  | 'INTIMAÇÃO'
  | 'CERTIDÃO'
  | 'EXPEDIÇÃO'
  | 'ARQUIVAMENTO'
  | 'BAIXA'
  | 'TRÂNSITO'
  | 'OUTROS'
  | 'ENCERRADO';

export interface AIAnalysis {
  categoria: AICategory;
  criticidade: 'BAIXA' | 'MÉDIA' | 'ALTA' | 'MÁXIMA';
  acaoSugerida: string;
  detalhes: string;
}

export class MovimentacaoAI {
  static analisar(mov: MovimentoNacional): AIAnalysis {
    const text = mov.descricao.toUpperCase();
    
    // 1. Detector de Encerramento (Soberania)
    if (EncerramentoDetector.isEncerrado(text)) {
      return { 
        categoria: 'ENCERRADO', 
        criticidade: 'ALTA', 
        acaoSugerida: 'Realizar baixa no sistema.', 
        detalhes: 'Detectado rito de finalização definitiva.'
      };
    }

    // 2. Classificação Técnica
    if (text.includes('SENTENÇA') || text.includes('SENTENCA')) 
      return this.build('SENTENÇA', 'MÁXIMA', 'Leitura urgente de sentença.');
    
    if (text.includes('DECISÃO')) 
      return this.build('DECISÃO', 'ALTA', 'Analisar determinação judicial.');
    
    if (text.includes('DESPACHO')) 
      return this.build('DESPACHO', 'MÉDIA', 'Cumprir despacho.');
    
    if (text.includes('PUBLICAÇÃO') || text.includes('DIÁRIO')) 
      return this.build('PUBLICAÇÃO', 'MÉDIA', 'Conferir Diário Oficial.');
    
    if (text.includes('PETIÇÃO') || text.includes('JUNTADA')) 
      return this.build('PETIÇÃO', 'BAIXA', 'Analisar peça anexada.');

    if (text.includes('RECURSO') || text.includes('APELAÇÃO') || text.includes('AGRAVO')) 
      return this.build('RECURSO', 'ALTA', 'Acompanhar instância superior.');

    if (text.includes('CONCLUSÃO') || text.includes('CONCLUSOS')) 
      return this.build('CONCLUSÃO', 'MÉDIA', 'Aguardando decisão.');

    if (text.includes('AUDIÊNCIA')) 
      return this.build('AUDIÊNCIA', 'ALTA', 'Preparar para audiência.');

    if (text.includes('INTIMAÇÃO')) 
      return this.build('INTIMAÇÃO', 'ALTA', 'Ciência obrigatória.');

    if (text.includes('CERTIDÃO')) 
      return this.build('CERTIDÃO', 'BAIXA', 'Conferir fé pública.');

    if (text.includes('EXPEDIÇÃO')) 
      return this.build('EXPEDIÇÃO', 'MÉDIA', 'Verificar documento expedido.');

    if (text.includes('ARQUIVAMENTO')) 
      return this.build('ARQUIVAMENTO', 'MÉDIA', 'Processo movido ao arquivo.');

    if (text.includes('BAIXA')) 
      return this.build('BAIXA', 'ALTA', 'Processo baixado.');

    if (text.includes('TRÂNSITO') || text.includes('TRANSITO')) 
      return this.build('TRÂNSITO', 'ALTA', 'Fim do prazo recursal.');

    return this.build('OUTROS', 'BAIXA', 'Andamento intermediário.', text);
  }

  private static build(cat: AICategory, crit: any, acao: string, desc?: string): AIAnalysis {
    return { categoria: cat, criticidade: crit, acaoSugerida: acao, detalhes: desc || cat };
  }
}

/**
 * @fileOverview Interpretador Neural de Movimentações MNI v3.0
 * Transforma dados brutos em informações resolutivas para o gabinete.
 * Classificação estrita conforme regras de Gabinete W1 Capital.
 */

import { MovimentoNacional } from '../types/dto';

export type AICategory = 
  | 'ENCERRADO'
  | 'PUBLICAÇÃO'
  | 'PETIÇÃO'
  | 'CONCLUSÃO'
  | 'ATO ORDINATÓRIO'
  | 'DECISÃO'
  | 'DESPACHO'
  | 'SENTENÇA'
  | 'AUDIÊNCIA'
  | 'INTIMAÇÃO'
  | 'EXPEDIÇÃO'
  | 'CERTIDÃO'
  | 'RECURSO'
  | 'NOVO ANDAMENTO'
  | 'SEM NOVOS ANDAMENTOS'
  | 'COM PRAZO'
  | 'OUTROS';

export interface AIAnalysis {
  categoria: AICategory;
  criticidade: 'BAIXA' | 'MÉDIA' | 'ALTA' | 'MÁXIMA';
  prioridade: number;
  risco: string;
  acaoSugerida: string;
  detalhes: string;
  motivoEncerramento?: string;
}

export class MovimentacaoAI {
  /**
   * Detecta encerramento definitivo baseado em palavras-chave mandatórias.
   */
  static detectarEncerramento(text: string): { encerrado: boolean; motivo: string | null } {
    const upper = text.toUpperCase();
    const termos = [
      'TRÂNSITO EM JULGADO', 'TRANSITO EM JULGADO', 'BAIXA DEFINITIVA', 
      'ARQUIVAMENTO DEFINITIVO', 'ARQUIVADO DEFINITIVAMENTE', 'ARQUIVAMENTO', 
      'ARQUIVADO', 'EXTINTO', 'PROCESSO EXTINTO', 'CANCELAMENTO DA DISTRIBUIÇÃO', 
      'REMESSA AO ARQUIVO', 'BAIXA', 'EXTINÇÃO'
    ];

    const match = termos.find(t => upper.includes(t));
    return match ? { encerrado: true, motivo: match } : { encerrado: false, motivo: null };
  }

  /**
   * Analisa a movimentação e classifica conforme a matriz técnica solicitada.
   */
  static analisar(mov: MovimentoNacional): AIAnalysis {
    const text = mov.descricao.toUpperCase();
    
    // 1. Ritos de Encerramento (Alta Precedência)
    const enc = this.detectarEncerramento(text);
    if (enc.encerrado) {
      return { 
        categoria: 'ENCERRADO', criticidade: 'ALTA', prioridade: 1, risco: 'Nenhum', 
        acaoSugerida: 'Realizar baixa interna.', detalhes: enc.motivo!
      };
    }

    // 2. Matriz de Classificação Técnica
    if (text.includes('PUBLICAÇÃO') || text.includes('DIÁRIO') || text.includes('DJEN')) 
      return this.buildResult('PUBLICAÇÃO', 'MÉDIA', 'Verificar Diário Oficial.');
    
    if (text.includes('PETIÇÃO') || text.includes('JUNTADA')) 
      return this.buildResult('PETIÇÃO', 'BAIXA', 'Analisar peça anexada.');
    
    if (text.includes('CONCLUSÃO') || text.includes('CONCLUSOS')) 
      return this.buildResult('CONCLUSÃO', 'MÉDIA', 'Aguardando decisão judicial.');
    
    if (text.includes('ATO ORDINATÓRIO')) 
      return this.buildResult('ATO ORDINATÓRIO', 'BAIXA', 'Andamento de secretaria.');
    
    if (text.includes('DECISÃO')) 
      return this.buildResult('DECISÃO', 'ALTA', 'Analisar determinação judicial.');
    
    if (text.includes('DESPACHO')) 
      return this.buildResult('DESPACHO', 'MÉDIA', 'Cumprir despacho.');
    
    if (text.includes('SENTENÇA') || text.includes('SENTENCA')) 
      return this.buildResult('SENTENÇA', 'MÁXIMA', 'Leitura urgente de sentença.');
    
    if (text.includes('AUDIÊNCIA') || text.includes('AUDIENCIA')) 
      return this.buildResult('AUDIÊNCIA', 'ALTA', 'Preparar para ato presencial/virtual.');
    
    if (text.includes('INTIMAÇÃO') || text.includes('INTIMACAO')) 
      return this.buildResult('INTIMAÇÃO', 'ALTA', 'Ciência obrigatória.');
    
    if (text.includes('EXPEDIÇÃO') || text.includes('EXPEDICAO')) 
      return this.buildResult('EXPEDIÇÃO', 'MÉDIA', 'Verificar documento expedido.');
    
    if (text.includes('CERTIDÃO') || text.includes('CERTIDAO')) 
      return this.buildResult('CERTIDÃO', 'BAIXA', 'Conferir fé pública.');
    
    if (text.includes('RECURSO') || text.includes('APELAÇÃO') || text.includes('AGRAVO')) 
      return this.buildResult('RECURSO', 'ALTA', 'Acompanhar instância superior.');

    if (text.includes('PRAZO') || text.includes('VENCIMENTO'))
      return this.buildResult('COM PRAZO', 'MÁXIMA', 'Protocolar manifestação.');

    return this.buildResult('OUTROS', 'BAIXA', 'Andamento intermediário.', text);
  }

  private static buildResult(cat: AICategory, crit: any, acao: string, desc?: string): AIAnalysis {
    return {
      categoria: cat,
      criticidade: crit,
      prioridade: crit === 'MÁXIMA' ? 0 : crit === 'ALTA' ? 1 : crit === 'MÉDIA' ? 2 : 3,
      risco: 'Normal',
      acaoSugerida: acao,
      detalhes: desc || cat
    };
  }
}

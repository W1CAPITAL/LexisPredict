/**
 * @fileOverview Interpretador Neural de Movimentações MNI v2.0
 * Transforma dados brutos em informações resolutivas para o gabinete.
 */

import { MovimentoNacional } from '../types/dto';

export type AICategory = 
  | 'NOVO ANDAMENTO' 
  | 'ENCERRADO' 
  | 'SEM NOVOS ANDAMENTOS'
  | 'EM RECURSO' 
  | 'NOVA PUBLICAÇÃO' 
  | 'NOVA PETIÇÃO' 
  | 'COM PRAZO'
  | 'DESPACHO'
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
   * Detecta se um conjunto de movimentações indica encerramento definitivo.
   */
  static detectarEncerramento(movs: MovimentoNacional[]): { encerrado: boolean; motivo: string | null } {
    const termosEncerramento = [
      'TRÂNSITO EM JULGADO', 'TRANSITO EM JULGADO', 'BAIXA DEFINITIVA', 
      'ARQUIVADO DEFINITIVAMENTE', 'ARQUIVAMENTO', 'CERTIDÃO DE BAIXA', 
      'BAIXA DE RECURSO', 'PROCESSO ENCERRADO', 'EXTINTO O PROCESSO', 
      'CANCELAMENTO DA DISTRIBUIÇÃO', 'REMESSA AO ARQUIVO', 
      'CUMPRIMENTO INTEGRAL DA SENTENÇA', 'EXTINÇÃO DA EXECUÇÃO', 'BAIXA DOS AUTOS'
    ];

    for (const mov of movs) {
      const text = mov.descricao.toUpperCase();
      const match = termosEncerramento.find(t => text.includes(t));
      if (match) return { encerrado: true, motivo: match };
    }

    return { encerrado: false, motivo: null };
  }

  /**
   * Analisa a movimentação mais recente e classifica sua utilidade.
   */
  static analisar(mov: MovimentoNacional): AIAnalysis {
    const text = mov.descricao.toUpperCase();
    
    // Ritos de Encerramento (Alta Prioridade)
    const enc = this.detectarEncerramento([mov]);
    if (enc.encerrado) {
      return { 
        categoria: 'ENCERRADO', 
        criticidade: 'ALTA', 
        prioridade: 1, 
        risco: 'Nenhum', 
        acaoSugerida: 'Realizar baixa na pasta interna e avisar cliente.',
        detalhes: enc.motivo || 'Baixa definitiva detectada.',
        motivoEncerramento: enc.motivo || undefined
      };
    }

    // Classificação por Tipo
    if (text.includes('RECURSO') || text.includes('APELAÇÃO') || text.includes('AGRAVO')) {
      return { categoria: 'EM RECURSO', criticidade: 'ALTA', prioridade: 2, risco: 'Médio', acaoSugerida: 'Acompanhar distribuição em 2º grau.', detalhes: 'Processo subiu para tribunal superior.' };
    }

    if (text.includes('PUBLICAÇÃO') || text.includes('DJEN') || text.includes('DIÁRIO')) {
      return { categoria: 'NOVA PUBLICAÇÃO', criticidade: 'MÉDIA', prioridade: 2, risco: 'Monitoramento', acaoSugerida: 'Verificar conteúdo da nota de expediente.', detalhes: 'Evento registrado no Diário Oficial.' };
    }

    if (text.includes('PETIÇÃO') || text.includes('JUNTADA')) {
      return { categoria: 'NOVA PETIÇÃO', criticidade: 'BAIXA', prioridade: 3, risco: 'Monitoramento', acaoSugerida: 'Analisar petição da parte contrária.', detalhes: 'Nova peça processual anexada.' };
    }

    if (text.includes('DESPACHO') || text.includes('DECISÃO')) {
      return { categoria: 'DESPACHO', criticidade: 'MÉDIA', prioridade: 2, risco: 'Alerta', acaoSugerida: 'Cumprir determinações judiciais.', detalhes: 'Magistrado proferiu nova ordem.' };
    }

    if (text.includes('PRAZO') || text.includes('VENCIMENTO')) {
      return { categoria: 'COM PRAZO', criticidade: 'MÁXIMA', prioridade: 0, risco: 'Alto', acaoSugerida: 'Protocolar manifestação urgente.', detalhes: 'Contagem regressiva processual ativa.' };
    }

    return {
      categoria: 'NOVO ANDAMENTO',
      criticidade: 'MÉDIA',
      prioridade: 3,
      risco: 'Normal',
      acaoSugerida: 'Analisar andamento no PJe/e-SAJ.',
      detalhes: mov.descricao
    };
  }
}

/**
 * @fileOverview Auditor Neural de Movimentações v7.0
 * Classificação Probabilística com Blindagem contra Null/Undefined.
 */

import { MovimentoNacional } from '../types/dto';

export type AuditCategory = 
  | 'Processo ativo'
  | 'Possível encerramento'
  | 'Possível arquivamento'
  | 'Em recurso'
  | 'Em conclusão'
  | 'Aguardando manifestação'
  | 'Nova petição'
  | 'Nova publicação'
  | 'Nova decisão'
  | 'Nova sentença'
  | 'Nova intimação'
  | 'Sem alterações'
  | 'Necessita conferência humana';

export interface AIAnalysis {
  categoria: AuditCategory;
  criticidade: 'BAIXA' | 'MÉDIA' | 'ALTA' | 'MÁXIMA';
  confianca: number; // 0-100
  acaoSugerida: string;
  detalhes: string;
}

export class MovimentacaoAI {
  static analisar(mov: MovimentoNacional | null): AIAnalysis {
    if (!mov) {
      return {
        categoria: 'Sem alterações',
        criticidade: 'BAIXA',
        confianca: 100,
        acaoSugerida: 'Manter monitoramento.',
        detalhes: 'Nenhuma movimentação nova identificada.'
      };
    }

    // Blindagem de descrição: Tenta múltiplas fontes de texto do tribunal
    const text = String(mov.descricao || mov.descricao || (mov as any).nome || (mov as any).texto || "ANDAMENTO SEM DESCRIÇÃO").toUpperCase();
    
    // 1. Possível Encerramento (Não afirma, sugere)
    if (/(TRÂNSITO EM JULGADO|TRANSITO EM JULGADO|BAIXA DEFINITIVA|BAIXA DOS AUTOS|EXTINTO|EXTINÇÃO|SENTENÇA DE EXTINÇÃO)/.test(text)) {
      return this.build('Possível encerramento', 'ALTA', 95, 'Realizar conferência oficial para baixa no sistema.', text);
    }

    // 2. Possível Arquivamento
    if (/(ARQUIVADO|ARQUIVAMENTO|REMESSA AO ARQUIVO|MANDADO DE ARQUIVAMENTO)/.test(text)) {
      return this.build('Possível arquivamento', 'MÉDIA', 90, 'Verificar se o arquivamento é definitivo ou provisório.', text);
    }

    // 3. Classificações Operacionais
    if (text.includes('SENTENÇA') || text.includes('SENTENCA')) 
      return this.build('Nova sentença', 'MÁXIMA', 98, 'Leitura urgente de sentença.', text);

    if (text.includes('DECISÃO') || text.includes('DECISAO')) 
      return this.build('Nova decisão', 'ALTA', 98, 'Analisar determinação judicial.', text);

    if (text.includes('RECURSO') || text.includes('APELAÇÃO') || text.includes('AGRAVO')) 
      return this.build('Em recurso', 'ALTA', 95, 'Acompanhar instância superior.', text);

    if (text.includes('CONCLUSÃO') || text.includes('CONCLUSOS')) 
      return this.build('Em conclusão', 'MÉDIA', 95, 'Aguardando decisão judicial.', text);

    if (text.includes('MANIFESTAÇÃO') || text.includes('DIGA A PARTE') || text.includes('ESPECIFICAÇÃO')) 
      return this.build('Aguardando manifestação', 'ALTA', 92, 'Peticionar conforme solicitado pelo juízo.', text);

    if (text.includes('PETIÇÃO') || text.includes('JUNTADA')) 
      return this.build('Nova petição', 'BAIXA', 90, 'Analisar peça anexada pela parte contrária.', text);

    if (text.includes('PUBLICAÇÃO') || text.includes('DIÁRIO')) 
      return this.build('Nova publicação', 'MÉDIA', 95, 'Conferir Diário Oficial.', text);

    if (text.includes('INTIMAÇÃO') || text.includes('INTIMACAO')) 
      return this.build('Nova intimação', 'ALTA', 95, 'Ciência obrigatória do andamento.', text);

    if (text.includes('DESPACHO')) 
      return this.build('Processo ativo', 'MÉDIA', 95, 'Cumprir despacho de rotina.', text);

    return this.build('Necessita conferência humana', 'BAIXA', 50, 'Revisar andamento não categorizado automaticamente.', text);
  }

  private static build(cat: AuditCategory, crit: any, conf: number, acao: string, details?: string): AIAnalysis {
    return { categoria: cat, criticidade: crit, confianca: conf, acaoSugerida: acao, detalhes: details || cat };
  }
}

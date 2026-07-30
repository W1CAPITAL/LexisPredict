/**
 * @fileOverview Detector de Encerramento Soberano v1.0
 * Identifica o fim da lide baseado em ritos processuais mandatórios.
 */

export class EncerramentoDetector {
  private static PATTERNS = [
    'TRANSITADO EM JULGADO',
    'TRÂNSITO EM JULGADO',
    'BAIXA DEFINITIVA',
    'PROCESSO BAIXADO',
    'ARQUIVADO',
    'ARQUIVAMENTO DEFINITIVO',
    'EXTINTO',
    'EXTINÇÃO',
    'CUMPRIMENTO INTEGRAL',
    'CANCELADO',
    'REMESSA AO ARQUIVO',
    'BAIXA NA DISTRIBUIÇÃO'
  ];

  static isEncerrado(text: string): boolean {
    const upper = text.toUpperCase();
    return this.PATTERNS.some(p => upper.includes(p));
  }
}

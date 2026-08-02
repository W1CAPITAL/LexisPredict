/**
 * @fileOverview Busca e Apreensão — DESATIVADO (v12.0)
 * Módulo neutralizado por excesso de falsos positivos operacionais.
 * Mantido apenas para compatibilidade de import. Nunca retorna indício.
 * @copyright 2026 W1 Capital / Davi Alves Figueredo
 */

export type BAConfidence = 'alta' | 'media' | 'baixa' | null;

export interface BAResult {
  indicio: boolean;
  confianca: BAConfidence;
  motivo: string | null;
}

/**
 * SEMPRE retorna sem indício. BA foi removido do produto.
 */
export function analisarBuscaApreensao(_data: any): BAResult {
  return { indicio: false, confianca: null, motivo: null };
}

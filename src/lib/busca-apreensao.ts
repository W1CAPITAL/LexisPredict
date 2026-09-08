

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

import type { LegalCase } from './case-logic';
export function isNovidadeAberta(c: Pick<LegalCase, 'tem_atualizacao_pos_retorno' | 'tem_novo_andamento' | 'djen_nova_comunicacao'>): boolean {
  return !!(c.tem_atualizacao_pos_retorno || c.tem_novo_andamento || c.djen_nova_comunicacao);
}
export function resolveTemNovoAndamento(c: any): boolean {
  return !!(c.tem_atualizacao_pos_retorno || c.djen_nova_comunicacao || c.tem_novo_andamento);
}
export function patchClearNovidade(): Record<string, boolean> {
  return { tem_atualizacao_pos_retorno: false, tem_novo_andamento: false, djen_nova_comunicacao: false };
}

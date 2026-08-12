/**
 * Política de verdade (inspirada Comp AI CRM):
 * Nada sobre cliente/processo é inventado.
 * Só fatos observados no texto, no banco ou na API (DataJud/DJEN).
 */

export const TRUTH_POLICY = {
  id: 'lexis-truth-v1',
  rules: [
    'Não inventar CNJ, nome, CPF, movimento ou valor ausente no contexto.',
    'Scripts e NER só usam matches explícitos no texto/movimentos.',
    'Cadastro: campos vazios ficam vazios; não completar com chute.',
    'Se insuficiente, dizer o que falta em vez de preencher.',
  ],
} as const;

/** Remove ou marca trechos que parecem placeholder inventado */
export function stripInventedPlaceholders(text: string): string {
  return String(text || '')
    .replace(/\[inserir[^\]]*\]/gi, '')
    .replace(/\[completar[^\]]*\]/gi, '')
    .replace(/\bTODO_FACT\b/g, '')
    .trim();
}

export function assertObservedFact(label: string, value: unknown): string | null {
  if (value === null || value === undefined || value === '') return null;
  const s = String(value).trim();
  if (!s) return null;
  if (/^(n\/a|nao informado|não informado|desconhecido|unknown)$/i.test(s)) return null;
  return s;
}

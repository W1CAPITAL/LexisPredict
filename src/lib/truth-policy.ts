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


/**
 * Regra única usada em documentos, IA e revisões operacionais.
 * Entrada textual nunca é prova autenticada nem consulta oficial confirmada.
 * Inspirada nos princípios de trilha fonte→afirmação do AuditorProcessual/Judicex.
 */
export type EvidenceTraceAssessment={
 status:'ausente'|'informada-nao-verificada';
 references:string[];
 requiresReview:true;
};

export function assessEvidenceTrace(raw:unknown):EvidenceTraceAssessment{
 const references=String(raw??'').split(/\r?\n/).map(x=>x.trim()).filter(Boolean).slice(0,50);
 return {status:references.length?'informada-nao-verificada':'ausente',references,requiresReview:true};
}

/** Mesmo contrato de precisão para os agentes, peças, CRM e relatórios. */
export function formatEvidenceGuidance():string{
 return 'Rastreabilidade de ponta a ponta: para cada fato ou conclusão relevante, identifique documento/evento, trecho/página, origem e data. Diferencie CONFIRMADO por fonte efetivamente consultada, RELATO, INDÍCIO e HIPÓTESE. Uma referência informada pelo operador não é automaticamente verificada; se não houver prova acessível, declare a lacuna. Não invente atos, prazos, pagamentos ou resultados e não execute ações externas sem revisão e autorização.';
}

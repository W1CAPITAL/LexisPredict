/** Respostas determinísticas, sempre identificadas como tais (não são LLM). */
export function localQuickReply(message: string): string | null {
  const clean = String(message || '').trim().replace(/\s+/g, ' ');
  if (/^(?:oi|ol[aá]|hello|hi|hey|e a[ií]|bom dia|boa tarde|boa noite)(?:[\s,!.?]+[\p{L}]{2,30})?[\s!.?]*$/iu.test(clean)) {
    return 'Olá! Estou aqui para ajudar. O que você precisa saber ou resolver?';
  }
  if (/^(?:obrigad[oa]|valeu|agradecid[oa])(?:[\s!.?]*)$/iu.test(clean)) {
    return 'Por nada! Se precisar de mais alguma coisa, estou à disposição.';
  }
  return null;
}

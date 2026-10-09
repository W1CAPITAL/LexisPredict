/** Respostas determinísticas, sempre identificadas como tais (não são LLM). */
export function localQuickReply(message: string): string | null {
  const clean = String(message || '').trim().replace(/\s+/g, ' ');
  if (/^(?:oi|ol[aá]|hello|hi|hey|e a[ií]|bom dia|boa tarde|boa noite)(?:[\s,!.?]+[\p{L}]{2,30})?[\s!.?]*$/iu.test(clean)) {
    return 'Olá! Estou aqui para ajudar. O que você precisa saber ou resolver?';
  }
  if (/^(?:obrigad[oa]|valeu|agradecid[oa])(?:[\s!.?]*)$/iu.test(clean)) {
    return 'Por nada! Se precisar de mais alguma coisa, estou à disposição.';
  }
  // Calculadora determinística para contas simples; não depende de GPU,
  // credenciais, internet ou download do modelo. Não utiliza eval.
  const math = clean.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase()
    .replace(/\?$/,'').trim()
    .replace(/^(?:quanto\s+(?:e|eh)|qual\s+(?:e|eh)\s+(?:o\s+)?resultado\s+(?:de|da)|calcule|calcula)\s*/,'');
  const matched = math.match(/^(-?\d+(?:[.,]\d+)?)\s*(mais|menos|vezes|multiplicado\s+por|dividido\s+por|[+*×÷/\-])\s*(-?\d+(?:[.,]\d+)?)$/);
  if (matched) {
    const a = Number(matched[1].replace(',','.'));
    const b = Number(matched[3].replace(',','.'));
    const op = matched[2];
    const result = op==='mais'||op==='+'?a+b:
      op==='menos'||op==='-'?a-b:
      op==='vezes'||op==='multiplicado por'||op==='*'||op==='×'?a*b:
      b===0?NaN:a/b;
    if (b===0&&(op==='dividido por'||op==='/'||op==='÷'))
      return 'Não é possível dividir por zero.';
    if (Number.isFinite(result)&&Number.isSafeInteger(a)&&Number.isSafeInteger(b)&&Math.abs(result)<1e15)
      return `O resultado é ${new Intl.NumberFormat('pt-BR',{maximumFractionDigits:8}).format(result)}.`;
  }
  if (/^[a-z]{1,3}$/i.test(clean)) return 'Pode escrever a pergunta completa? Assim consigo responder com precisão.';
  return null;
}

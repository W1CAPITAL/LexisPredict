/**
 * Parser thinking/answer — arquivo SEM "use server".
 */
export function parseThinkingAnswer(raw: string): { thinking: string | null; answer: string } {
  let t = String(raw || '').trim();
  if (!t) return { thinking: null, answer: '' };

  t = t
    .replace(/<\s*thinking\s*>/gi, '<thinking>')
    .replace(/<\s*\/\s*thinking\s*>/gi, '</thinking>')
    .replace(/<\s*answer\s*>/gi, '<answer>')
    .replace(/<\s*\/\s*answer\s*>/gi, '</answer>');

  const thinkM = t.match(/<thinking>([\s\S]*?)<\/thinking>/i);
  const ansM = t.match(/<answer>([\s\S]*?)<\/answer>/i);

  let thinking: string | null = thinkM ? thinkM[1].trim() : null;
  let answer = ansM ? ansM[1].trim() : t;

  if (!ansM && thinkM) {
    answer = t.replace(/<thinking>[\s\S]*?<\/thinking>/i, '').trim();
  }

  answer = answer
    .replace(/<\/?thinking>/gi, '')
    .replace(/<\/?answer>/gi, '')
    .replace(/<\/?raciocinio>/gi, '')
    .replace(/<\/?resposta>/gi, '')
    .trim();

  if (thinking) {
    thinking = thinking.replace(/<\/?thinking>/gi, '').trim();
  }

  return {
    thinking: thinking || null,
    answer: answer || t.replace(/<[^>]+>/g, '').trim(),
  };
}

export function isSimplePrompt(pergunta: string, hasAttach: boolean): boolean {
  if (hasAttach) return false;
  const p = pergunta.trim().toLowerCase();
  if (p.length > 80) return false;
  if (/^\s*(oi|ola|olá|hey|hello|hi|bom dia|boa tarde|boa noite|obrigad[oa]|valeu|ok|blz|eai|e aí)\s*[!.?]*\s*$/i.test(p)) {
    return true;
  }
  if (p.split(/\s+/).length <= 4 && !/\d{7}/.test(p)) return true;
  return false;
}

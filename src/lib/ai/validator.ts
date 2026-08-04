/**
 * Validação de saídas de IA — evita texto desformatado na UI.
 */

export type ValidateResult =
  | { ok: true; text: string }
  | { ok: false; error: string };

export function validateAiText(
  raw: unknown,
  opts?: { minLen?: number; expectJson?: boolean }
): ValidateResult {
  const minLen = opts?.minLen ?? 2;
  if (raw == null) return { ok: false, error: 'Motor retornou vazio.' };

  let text = typeof raw === 'string' ? raw : String(raw);
  text = text.replace(/\u0000/g, '').trim();

  if (!text) return { ok: false, error: 'Motor retornou string vazia.' };
  if (text.length < minLen) {
    return { ok: false, error: `Resposta inválida (muito curta: ${text.length} chars).` };
  }

  if (/^(undefined|null|NaN|\[object Object\])$/i.test(text)) {
    return { ok: false, error: `Resposta inválida: ${text}` };
  }

  if (opts?.expectJson) {
    try {
      let clean = text.replace(/```json/gi, '').replace(/```/g, '').trim();
      const a = clean.indexOf('{');
      const b = clean.lastIndexOf('}');
      if (a === -1 || b === -1 || b <= a) {
        return { ok: false, error: 'JSON esperado não encontrado na resposta.' };
      }
      JSON.parse(clean.substring(a, b + 1));
    } catch (e: any) {
      return {
        ok: false,
        error: `JSON malformado: ${e?.message || 'parse error'}`,
      };
    }
  }

  return { ok: true, text };
}

/** Alias usado por chat-service */
export function validateAIResponse(raw: unknown): ValidateResult {
  return validateAiText(raw);
}

/** Remove cercas markdown / espaços */
export function cleanResponse(raw: unknown): string {
  let text = typeof raw === 'string' ? raw : String(raw ?? '');
  text = text.replace(/```json/gi, '').replace(/```/g, '').trim();
  return text;
}

export function formatAiErrorForUser(err: unknown, engine?: string): string {
  const msg = err instanceof Error ? err.message : String(err || 'Erro desconhecido');
  const eng = engine ? ` [${engine}]` : '';
  if (/api key|401|unauthorized|authentication/i.test(msg)) {
    return `Erro de autenticação do motor${eng}: verifique as keys no Vercel. Detalhe: ${msg}`;
  }
  if (/429|rate limit/i.test(msg)) {
    return `Limite de requisições do motor${eng}. Aguarde e tente de novo. Detalhe: ${msg}`;
  }
  if (/timeout|aborted|network/i.test(msg)) {
    return `Timeout/rede no motor${eng}. Detalhe: ${msg}`;
  }
  return `Falha no motor neural${eng}: ${msg}`;
}

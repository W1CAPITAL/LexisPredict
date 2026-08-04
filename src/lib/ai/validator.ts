export type ValidateResult =
  | { ok: true; text: string }
  | { ok: false; error: string };

export function validateAiText(
  raw: unknown,
  opts?: { minLen?: number; expectJson?: boolean }
): ValidateResult {
  const minLen = opts?.minLen ?? 2;
  if (raw == null) return { ok: false, error: 'vazio' };
  let text = typeof raw === 'string' ? raw : String(raw);
  text = text.replace(/\u0000/g, '').trim();
  if (!text || text.length < minLen) return { ok: false, error: 'curto' };
  if (/^(undefined|null|NaN|\[object Object\])$/i.test(text)) {
    return { ok: false, error: text };
  }
  if (opts?.expectJson) {
    try {
      let clean = text.replace(/```json/gi, '').replace(/```/g, '').trim();
      const a = clean.indexOf('{');
      const b = clean.lastIndexOf('}');
      if (a < 0 || b <= a) return { ok: false, error: 'json' };
      JSON.parse(clean.substring(a, b + 1));
    } catch {
      return { ok: false, error: 'json parse' };
    }
  }
  return { ok: true, text };
}

/** chat-service chama com (content, format) */
export function validateAIResponse(
  raw: unknown,
  responseFormat?: string
): boolean {
  const expectJson =
    responseFormat === 'json' ||
    responseFormat === 'json_object' ||
    responseFormat === 'application/json';
  return validateAiText(raw, { expectJson }).ok;
}

export function cleanResponse(raw: unknown): string {
  let text = typeof raw === 'string' ? raw : String(raw ?? '');
  return text.replace(/```json/gi, '').replace(/```/g, '').trim();
}

export function formatAiErrorForUser(err: unknown, engine?: string): string {
  const msg = err instanceof Error ? err.message : String(err || 'Erro');
  return `Falha neural${engine ? ` [${engine}]` : ''}: ${msg}`;
}

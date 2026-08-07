/**
 * Senha de gabinete / master — NUNCA hardcode no client.
 * Valor só em process.env.MASTER_PASSWORD (servidor).
 */
export function getMasterPassword(): string | null {
  const v = (process.env.MASTER_PASSWORD || process.env.GABINETE_MASTER_PASSWORD || '').trim();
  return v.length >= 8 ? v : null;
}

export function matchMasterPassword(input: string | null | undefined): boolean {
  const expected = getMasterPassword();
  if (!expected) return false;
  const got = String(input || '');
  if (got.length !== expected.length) return false;
  // comparação em tempo constante simples
  let diff = 0;
  for (let i = 0; i < expected.length; i++) {
    diff |= got.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return diff === 0;
}

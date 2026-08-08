'use server';

import { matchMasterPassword, getMasterPassword } from '@/lib/master-password';
import { getUserContext } from '@/lib/server-db';

/**
 * Valida senha de gabinete no SERVIDOR (env MASTER_PASSWORD).
 * Não existe senha fixa no código-fonte do client.
 */
export async function verifyMasterPasswordAction(password: string): Promise<{
  ok: boolean;
  error?: string;
}> {
  try {
    const ctx = await getUserContext();
    if (!ctx?.empresa_id) {
      return { ok: false, error: 'Sessão expirada. Faça login novamente.' };
    }
    if (!getMasterPassword()) {
      return {
        ok: false,
        error: 'MASTER_PASSWORD não configurada no servidor (Vercel env).',
      };
    }
    if (!matchMasterPassword(password)) {
      return { ok: false, error: 'Senha de gabinete inválida.' };
    }
    return { ok: true };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Falha na validação.';
    return { ok: false, error: msg };
  }
}

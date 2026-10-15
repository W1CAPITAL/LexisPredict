"use server";

/** Compatibilidade para o cadastro completo da banca.
 * O salvamento real valida a sessão, restringe empresa_id e permite somente
 * as colunas de advogados_banca, sem criar um cliente admin desacoplado.
 */
export async function upsertAdvogadoBancaCompleto(adv: Record<string, any>) {
  const { upsertAdvogadoBanca } = await import("@/lib/server-db");
  return upsertAdvogadoBanca({
    ...adv,
    estado_civil: adv.estado_civil ?? adv.estadoCivil ?? null,
    email_profissional: adv.email_profissional ?? adv.emailProfissional ?? null,
  });
}

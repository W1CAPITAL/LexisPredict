/**
 * Identificadores de proprietários da carteira legada.
 * A coluna created_by registra ora usuarios.auth_user_id, ora usuarios.id.
 * Ambos pertencem ao MESMO usuário validado no servidor.
 * Nunca aceitar esses IDs de query, payload do browser ou URL.
 */
export function createdByOwnerIds(authId: string | null | undefined, profileId: string | null | undefined): string[] {
  const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return Array.from(new Set([authId,profileId]
    .map(v=>String(v||'').trim())
    .filter(v=>uuid.test(v))));
}

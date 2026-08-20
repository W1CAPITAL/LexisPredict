
const SUPERVISAO_AUTH =
  process.env.ATENDIMENTO_CREDIT_FROM ||
  'e6e05b7b-dc9b-4786-9f3f-4bbbf3a922f9';
const CREDITO_PARA =
  process.env.ATENDIMENTO_CREDIT_TO ||
  '4581d2fe-c358-45f9-a1bd-f90f93dce0fc';

export function resolveAtendidoPorCredito(
  authUserId?: string | null,
  nomePerfil?: string | null
): string | null {
  if (!authUserId && !nomePerfil) return null;
  const uid = authUserId ? String(authUserId) : '';
  const nome = String(nomePerfil || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toUpperCase();
  if (uid && uid === SUPERVISAO_AUTH) return CREDITO_PARA;
  if (nome && nome.startsWith('SUPERVIS')) return CREDITO_PARA;
  return uid || null;
}

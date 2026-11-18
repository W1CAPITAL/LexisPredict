/**
 * Resolve o banco do servidor sem expor SERVICE_ROLE ao aplicativo instalado.
 * Na ausência de chave administrativa, mantém a identidade da sessão SSR e as RLS.
 */
export async function createAuthorizedDatabaseClient<T>(
  options: {
    adminKey?: string | null;
    makeAdmin: () => Promise<T>;
    makeRequest: () => Promise<T | null>;
  },
): Promise<T> {
  if (options.adminKey?.trim()) return options.makeAdmin();
  const request = await options.makeRequest();
  if (!request) throw new Error('Sessão Supabase indisponível. Entre novamente.');
  const db = request as { auth?: { getUser?: () => Promise<{ data?: {user?: {id?: string}|null}; error?: unknown }> } };
  if (typeof db.auth?.getUser !== 'function')
    throw new Error('Sessão Supabase indisponível. Entre novamente.');
  const {data,error} = await db.auth.getUser();
  if (error || !data?.user?.id)
    throw new Error('Sessão Supabase indisponível. Entre novamente.');
  return request;
}

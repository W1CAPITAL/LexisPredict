/**
 * Resumo obtido por RPC protegida no próprio Supabase.
 * O banco deriva a empresa de auth.uid(), sem aceitar empresa indicada pelo navegador.
 */
export type DesktopSnapshot = {
  portfolio: Record<string, unknown>;
  merito: Record<string, unknown> | null;
  retorno: Record<string, unknown> | null;
};
export async function readAuthorizedDesktopSnapshot(
  db: {rpc: (name: string, args: {p_owner:string|null}) => PromiseLike<{data: unknown; error: {code?:string;message?:string}|null}>},
  empresaId: string,
  ownerId: string|null,
): Promise<DesktopSnapshot> {
  const {data,error} = await db.rpc('lexis_desktop_portfolio_snapshot',{p_owner:ownerId});
  if(error || !data || typeof data!=='object')
    throw new Error('Resumo da carteira indisponível no Supabase.');
  const snapshot=data as Record<string,unknown>;
  if(snapshot.empresa_id!==empresaId)
    throw new Error('Organização da carteira não corresponde à sessão autenticada.');
  const portfolio=snapshot.portfolio;
  if(!portfolio || typeof portfolio!=='object' ||
     !Number.isFinite(Number((portfolio as Record<string,unknown>).total)))
    throw new Error('Resumo da carteira indisponível no Supabase.');
  const value=(obj:unknown):Record<string,unknown>|null =>
    obj&&typeof obj==='object'&&!Array.isArray(obj)?obj as Record<string,unknown>:null;
  return {portfolio:portfolio as Record<string,unknown>,merito:value(snapshot.merito),retorno:value(snapshot.retorno)};
}

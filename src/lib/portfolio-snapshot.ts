import {unstable_cache} from 'next/cache';
import {getSupabaseAdmin} from '@/lib/server-db';
import {createClient as createRequestClient} from '@/lib/supabase/server';
import {readAuthorizedDesktopSnapshot} from '@/lib/desktop-portfolio-snapshot';
import {cache} from 'react';

/**
 * Short-lived, tenant+owner scoped database summaries.
 * Every caller MUST authenticate the user and derive company/owner server-side.
 * Thirty seconds of caching avoids repeated costly JSON scans when the dashboard
 * and portfolio open at once. Failures are never treated as zero counts.
 */
const getAdminPortfolioSnapshotCached = unstable_cache(
  async (empresaId:string,ownerId:string|null) => {
    const db=await getSupabaseAdmin();
    const {data,error}=await db.rpc('lexis_portfolio_snapshot',{
      p_empresa:empresaId,p_owner:ownerId
    });
    if(error||!Array.isArray(data)||!data[0]){
      console.error('[portfolio-snapshot] unavailable',error?.code||'empty');
      throw new Error('portfolio_snapshot_unavailable');
    }
    return data[0] as Record<string,unknown>;
  },['lexis-portfolio-snapshot-v2'],{revalidate:30}
);
const getAdminMeritoSnapshotCached = unstable_cache(
  async (empresaId:string,ownerId:string|null) => {
    const db=await getSupabaseAdmin();
    const {data,error}=await db.rpc('lexis_merito_snapshot',{
      p_empresa:empresaId,p_owner:ownerId
    });
    if(error||!data||typeof data!=='object')throw new Error('merito_snapshot_unavailable');
    return data as Record<string,unknown>;
  },['lexis-merito-snapshot-v2'],{revalidate:30}
);
const getAdminRetornoSnapshotCached = unstable_cache(
  async (empresaId:string,ownerId:string|null) => {
    const db=await getSupabaseAdmin();
    const {data,error}=await db.rpc('lexis_retorno_snapshot',{
      p_empresa:empresaId,p_owner:ownerId,p_dias:30
    });
    if(error||!data||typeof data!=='object')throw new Error('retorno_snapshot_unavailable');
    return data as Record<string,unknown>;
  },['lexis-retorno-snapshot-v2'],{revalidate:30}
);

/**
 * A instalação desktop não carrega segredo Vercel. Ao faltar service role, a
 * função SQL autenticada resolve a empresa pelo JWT e executa o mesmo resumo
 * autoritativo, preservando o significado dos KPIs de /processos e do painel.
 */
const getRequestPortfolioSnapshots=cache(async (empresaId:string,ownerId:string|null)=>{
  const client=await createRequestClient();
  if(!client)throw new Error('Sessão Supabase indisponível.');
  const {data:{user},error}=await client.auth.getUser();
  if(error||!user||ownerId!==null&&ownerId!==user.id)
    throw new Error('Sessão Supabase inválida para a carteira.');
  return readAuthorizedDesktopSnapshot(client,empresaId,ownerId);
});
export async function getPortfolioSnapshotCached(empresaId:string,ownerId:string|null){
  if(process.env.SUPABASE_SERVICE_ROLE_KEY)
    return getAdminPortfolioSnapshotCached(empresaId,ownerId);
  return (await getRequestPortfolioSnapshots(empresaId,ownerId)).portfolio;
}
export async function getMeritoSnapshotCached(empresaId:string,ownerId:string|null){
  if(process.env.SUPABASE_SERVICE_ROLE_KEY)
    return getAdminMeritoSnapshotCached(empresaId,ownerId);
  const data=(await getRequestPortfolioSnapshots(empresaId,ownerId)).merito;
  if(!data)throw new Error('merito_snapshot_unavailable');
  return data;
}
export async function getRetornoSnapshotCached(empresaId:string,ownerId:string|null){
  if(process.env.SUPABASE_SERVICE_ROLE_KEY)
    return getAdminRetornoSnapshotCached(empresaId,ownerId);
  const data=(await getRequestPortfolioSnapshots(empresaId,ownerId)).retorno;
  if(!data)throw new Error('retorno_snapshot_unavailable');
  return data;
}

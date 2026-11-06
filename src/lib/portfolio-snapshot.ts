import {unstable_cache} from 'next/cache';
import {getSupabaseAdmin} from '@/lib/server-db';

/**
 * Short-lived, tenant+owner scoped database summaries.
 * Every caller MUST authenticate the user and derive company/owner server-side.
 * Thirty seconds of caching avoids repeated costly JSON scans when the dashboard
 * and portfolio open at once. Failures are never treated as zero counts.
 */
export const getPortfolioSnapshotCached = unstable_cache(
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
export const getMeritoSnapshotCached = unstable_cache(
  async (empresaId:string,ownerId:string|null) => {
    const db=await getSupabaseAdmin();
    const {data,error}=await db.rpc('lexis_merito_snapshot',{
      p_empresa:empresaId,p_owner:ownerId
    });
    if(error||!data||typeof data!=='object')throw new Error('merito_snapshot_unavailable');
    return data as Record<string,unknown>;
  },['lexis-merito-snapshot-v2'],{revalidate:30}
);
export const getRetornoSnapshotCached = unstable_cache(
  async (empresaId:string,ownerId:string|null) => {
    const db=await getSupabaseAdmin();
    const {data,error}=await db.rpc('lexis_retorno_snapshot',{
      p_empresa:empresaId,p_owner:ownerId,p_dias:30
    });
    if(error||!data||typeof data!=='object')throw new Error('retorno_snapshot_unavailable');
    return data as Record<string,unknown>;
  },['lexis-retorno-snapshot-v2'],{revalidate:30}
);

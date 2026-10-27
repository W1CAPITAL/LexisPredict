import { NextRequest, NextResponse } from 'next/server';
import { getStoredCasesPageForEmpresa, getSupabaseAdmin, getUserContext } from '@/lib/server-db';

/**
 * Paginated, tenant-authenticated HTTP endpoint. Avoids large Next Server Action
 * payloads and avoids blocking the first paint on ranking/audit/JSON scans.
 * Never accepts tenantId, ownerId or permissions from the browser.
 */
export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const maxDuration = 25;
type Snapshot = {
  total: number; ativos: number; encerrados: number; vencidos: number;
  baixas: number; procedentes: number; cumprimentos: number; novidades: number;
  improcedentes:number; parciais:number; divergentesMerito:number; semIndicador:number;
  cumprimentosPendentes:number; cumprimentosRevisar:number; cumprimentosSinalizados:number; cumprimentosEncerrados:number; meritoDisponivel:boolean;
  semRetorno30?:number; semRetornoNunca?:number; retornoDisponivel?:boolean;
};
const EMPTY: Snapshot = { total: 0, ativos: 0, encerrados: 0, vencidos: 0, baixas: 0, procedentes: 0, cumprimentos: 0, novidades: 0, improcedentes:0,parciais:0,divergentesMerito:0,semIndicador:0,cumprimentosPendentes:0,cumprimentosRevisar:0,cumprimentosSinalizados:0,cumprimentosEncerrados:0,meritoDisponivel:false,semRetorno30:undefined,semRetornoNunca:undefined,retornoDisponivel:false };
const headers = { 'Cache-Control': 'private, no-store, max-age=0', 'Vary': 'Cookie', 'X-Content-Type-Options': 'nosniff' };
const safeInt = (raw: string | null, fallback: number, max: number) =>
  Math.max(0, Math.min(max, Number.isFinite(Number(raw)) && raw !== null ? Math.trunc(Number(raw)) : fallback));

export async function GET(request: NextRequest) {
  try {
    const ctx = await getUserContext();
    if (!ctx.auth_id || !ctx.empresa_id)
      return NextResponse.json({ ok: false, error: 'Faça login novamente.' }, { status: 401, headers });
    const u = new URL(request.url);
    const scope = u.searchParams.get('scope') === 'empresa' ? 'empresa' : 'mine';
    const limit = Math.max(1, safeInt(u.searchParams.get('limit'), 60, 400));
    const withSummary = u.searchParams.get('summary') !== '0';
    const includeDetails = u.searchParams.get('details') === '1';
    const offset = safeInt(u.searchParams.get('offset'), 0, 100000);
    const empresaId = String(ctx.empresa_id);
    const db = await getSupabaseAdmin();

    const ownerScope=scope==='empresa'||ctx.caseScope==='empresa'?null:ctx.auth_id;
    const [listResult, countResult, meritoResult, retornoResult] = await Promise.all([
      getStoredCasesPageForEmpresa(empresaId, limit, offset, false, {
        companyReadOnly: scope === 'empresa',
        onlyAtivos: false,
        includeDetails,
        validatedContext: ctx,
      }),
      // RPC runs one indexed SQL aggregation in Postgres, not three large JSON
      // downloads over the network. It is callable only with service_role.
      withSummary ? db.rpc('lexis_portfolio_snapshot', {
        p_empresa: empresaId,
        p_owner: scope === 'empresa' || ctx.caseScope === 'empresa' ? null : ctx.auth_id,
      }) : Promise.resolve({ data: null, error: null }),
      withSummary ? db.rpc('lexis_merito_snapshot',{
        p_empresa:empresaId,p_owner:ownerScope
      }) : Promise.resolve({data:null,error:null}),
      withSummary ? db.rpc('lexis_retorno_snapshot',{
        p_empresa:empresaId,p_owner:ownerScope,p_dias:30
      }) : Promise.resolve({data:null,error:null}),
    ]);
    let snapshot: Snapshot = { ...EMPTY };
    if (!withSummary) {
      return NextResponse.json({ ok: true, cases: listResult, summary: snapshot,
        totalCount: null, totalCountExact: false, offset, limit, hasMore: listResult.length === limit }, { headers });
    }
    if (!countResult.error && Array.isArray(countResult.data) && countResult.data[0]) {
      const row = countResult.data[0] as Record<string, unknown>;
      snapshot={...EMPTY,...Object.fromEntries(
        ['total','ativos','encerrados','vencidos','baixas','procedentes','cumprimentos','novidades']
          .map(k=>[k,Number(row[k]||0)])
      )} as Snapshot;
    } else {
      // Nunca exibir zero nem substituir uma contagem oficial por registros
      // de uma única página: o KPI ficaria incorreto sem qualquer aviso.
      console.error('[api/carteira/fast] snapshot indisponível',countResult.error);
      return NextResponse.json({
        ok:false,error:'Resumo indisponível no banco. A carteira não foi alterada; atualize os indicadores após recuperar a conexão.',
        code:'portfolio_snapshot_unavailable'
      },{status:503,headers});
    }
    if(!meritoResult.error && meritoResult.data && typeof meritoResult.data==='object'){
      const m=meritoResult.data as Record<string,unknown>;
      snapshot.procedentes=Number(m.procedentes||0);
      snapshot.improcedentes=Number(m.improcedentes||0);
      snapshot.parciais=Number(m.parciais||0);
      snapshot.divergentesMerito=Number(m.divergentes||0);
      snapshot.semIndicador=Number(m.semIndicador||0);
      snapshot.cumprimentos=Number(m.cumprimentosAtivos||0);
      snapshot.cumprimentosPendentes=Number(m.cumprimentosPendentes||0);
      snapshot.cumprimentosRevisar=Number(m.cumprimentosRevisar||0);
      snapshot.cumprimentosSinalizados=Number(m.cumprimentosSinalizados||0);
      snapshot.cumprimentosEncerrados=Number(m.cumprimentosEncerrados||0);
      snapshot.meritoDisponivel=true;
    } else if(withSummary){
      console.warn('[api/carteira/fast] mérito indisponível',meritoResult.error);
    }
    if(!retornoResult.error && retornoResult.data && typeof retornoResult.data==='object'){
      const t=retornoResult.data as Record<string,unknown>;
      snapshot.semRetorno30=Number(t.semRetornoLongo||0);
      snapshot.semRetornoNunca=Number(t.nuncaRegistrado||0);
      snapshot.retornoDisponivel=true;
    } else if(withSummary){
      console.warn('[api/carteira/fast] retorno longo indisponível',retornoResult.error);
    }
    return NextResponse.json({
      ok: true, cases: listResult, summary: snapshot,
      totalCount: snapshot.total, offset, limit,
      hasMore: offset + listResult.length < snapshot.total,
    }, { headers });
  } catch (e) {
    console.error('[api/carteira/fast] failed', e instanceof Error ? e.message : 'unknown');
    return NextResponse.json({ ok: false, error: 'Não foi possível consultar o Supabase. Tente novamente.' }, { status: 503, headers });
  }
}

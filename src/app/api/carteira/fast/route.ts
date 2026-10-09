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
};
const EMPTY: Snapshot = { total: 0, ativos: 0, encerrados: 0, vencidos: 0, baixas: 0, procedentes: 0, cumprimentos: 0, novidades: 0 };
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

    const [listResult, countResult] = await Promise.all([
      getStoredCasesPageForEmpresa(empresaId, limit, offset, false, {
        companyReadOnly: scope === 'empresa',
        onlyAtivos: false,
        includeDetails,
      }),
      // RPC runs one indexed SQL aggregation in Postgres, not three large JSON
      // downloads over the network. It is callable only with service_role.
      withSummary ? db.rpc('lexis_portfolio_snapshot', {
        p_empresa: empresaId,
        p_owner: scope === 'empresa' || ctx.caseScope === 'empresa' ? null : ctx.auth_id,
      }) : Promise.resolve({ data: null, error: null }),
    ]);
    let snapshot: Snapshot = { ...EMPTY };
    if (!withSummary) {
      return NextResponse.json({ ok: true, cases: listResult, summary: snapshot,
        totalCount: 0, offset, limit, hasMore: listResult.length === limit }, { headers });
    }
    if (!countResult.error && Array.isArray(countResult.data) && countResult.data[0]) {
      const row = countResult.data[0] as Record<string, unknown>;
      snapshot = Object.fromEntries(Object.keys(EMPTY).map((k) =>
        [k, Number(row[k] || 0)])) as Snapshot;
    } else {
      // Preserve page availability if a database migration is temporarily missing.
      const q = db.from('processos').select('id', { count: 'exact', head: true }).eq('empresa_id', empresaId);
      const { count } = scope === 'empresa' || ctx.caseScope === 'empresa'
        ? await q : await q.eq('created_by', ctx.auth_id);
      snapshot.total = count ?? listResult.length;
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

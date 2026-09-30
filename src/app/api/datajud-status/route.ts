/**
 * @fileOverview API de Telemetria de Auditoria v1.0
 * Retorna o status atual dos processos ativos da empresa.
 */

import { NextResponse } from 'next/server';
import { getUserContext, getScanStatusMetrics } from '@/lib/server-db';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { empresa_id } = await getUserContext();
    if (!empresa_id) return new Response('Unauthorized', { status: 401 });

    const { searchParams } = new URL(request.url);
    const rawMode = searchParams.get('mode');
    const rawScope = searchParams.get('scope');
    const mode =
      rawMode === 'datajud' || rawMode === 'djen' || rawMode === 'both'
        ? rawMode
        : 'both';
    const scope = rawScope === 'cumprimento' ? 'cumprimento' : 'full';
    const since = searchParams.get('since');

    const metrics = await getScanStatusMetrics(empresa_id, {
      mode,
      scope,
      since,
    });
    return NextResponse.json(metrics);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
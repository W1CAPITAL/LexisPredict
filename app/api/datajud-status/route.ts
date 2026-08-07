/**
 * @fileOverview API de Telemetria de Auditoria v1.0
 * Retorna o status atual dos processos ativos da empresa.
 */

import { NextResponse } from 'next/server';
import { getUserContext, getScanStatusMetrics } from '@/lib/server-db';

export const dynamic = 'force-dynamic';
export const preferredRegion = 'gru1';

export async function GET() {
  try {
    const { empresa_id } = await getUserContext();
    if (!empresa_id) return new Response('Unauthorized', { status: 401 });

    const metrics = await getScanStatusMetrics(empresa_id);
    return NextResponse.json(metrics);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
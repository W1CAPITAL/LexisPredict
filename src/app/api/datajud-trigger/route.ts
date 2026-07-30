
/**
 * @fileOverview Trigger Assíncrono de Auditoria DataJud v1.0
 * Dispara micro-lotes no worker e responde imediatamente.
 */

import { NextResponse } from 'next/server';
import { getUserContext } from '@/lib/server-db';
import { headers } from 'next/headers';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const { empresa_id } = await getUserContext();
    if (!empresa_id) return new Response('Unauthorized', { status: 401 });

    const h = await headers();
    const host = h.get('host');
    const protocol = host?.includes('localhost') ? 'http' : 'https';
    const baseUrl = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : `${protocol}://${host}`;

    // Dispara gatilho Fire-and-Forget
    fetch(`${baseUrl}/api/datajud-worker?empresa_id=${empresa_id}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.DATAJUD_WORKER_SECRET}`,
        'Content-Type': 'application/json'
      }
    }).catch(() => {}); // Ignora erro aqui pois o poling cuidará do status

    return NextResponse.json({ started: true });
  } catch (error: any) {
    return NextResponse.json({ started: false, error: error.message }, { status: 500 });
  }
}

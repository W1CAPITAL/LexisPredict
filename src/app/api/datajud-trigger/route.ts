/**
 * @fileOverview Trigger assíncrono — dispara worker BOTH (substitui Cron no Hobby)
 */
import { NextResponse } from 'next/server';
import { getUserContext } from '@/lib/server-db';
import { headers } from 'next/headers';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const { empresa_id } = await getUserContext();
    if (!empresa_id) return new Response('Unauthorized', { status: 401 });

    let mode = 'both';
    try {
      const body = await request.clone().json().catch(() => ({}));
      if (body?.mode && ['datajud', 'djen', 'both'].includes(body.mode)) mode = body.mode;
    } catch {
      /* ignore */
    }

    const h = await headers();
    const host = h.get('host');
    const protocol = host?.includes('localhost') ? 'http' : 'https';
    const baseUrl = process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : `${protocol}://${host}`;

    // Fire-and-forget worker
    fetch(
      `${baseUrl}/api/datajud-worker?empresa_id=${encodeURIComponent(empresa_id)}&mode=${encodeURIComponent(mode)}`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.DATAJUD_WORKER_SECRET}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ mode }),
      }
    ).catch(() => {});

    return NextResponse.json({ started: true, mode });
  } catch (error: any) {
    return NextResponse.json({ started: false, error: error.message }, { status: 500 });
  }
}

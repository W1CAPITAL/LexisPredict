import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const preferredRegion = 'gru1';

export async function POST(request: Request) {
  const auth = request.headers.get('Authorization');
  if (auth !== `Bearer ${process.env.DATAJUD_WORKER_SECRET}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  let body: any = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const empresa_id = body.empresa_id;
  const mode = body.mode || 'both';

  if (!empresa_id) {
    return NextResponse.json({ error: 'empresa_id' }, { status: 400 });
  }

  const base =
    process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');

  const res = await fetch(
    `${base}/api/datajud-worker?empresa_id=${encodeURIComponent(empresa_id)}&mode=${encodeURIComponent(mode)}`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.DATAJUD_WORKER_SECRET}`,
      },
    }
  );

  let payload: any = null;
  try {
    payload = await res.json();
  } catch {
    payload = null;
  }

  return NextResponse.json({
    via: 'direct',
    status: res.status,
    worker: payload,
  });
}

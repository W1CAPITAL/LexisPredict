import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const auth = request.headers.get('Authorization');
  const secret = process.env.DATAJUD_WORKER_SECRET?.trim();
  // Never authenticate the literal "Bearer undefined"/"Bearer " if the
  // worker secret has not been configured on this deployment.
  if (!secret || auth !== `Bearer ${secret}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  let body: any = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const empresa_id = typeof body.empresa_id === 'string' ? body.empresa_id.trim() : '';
  const mode = ['both', 'datajud', 'djen'].includes(body.mode) ? body.mode : 'both';
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(empresa_id)) {
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
        Authorization: `Bearer ${secret}`,
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

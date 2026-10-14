import { NextResponse } from 'next/server';
import { timingSafeEqual } from 'node:crypto';
// Campaign work is exclusively claimed by a scoped linked-device worker.

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

function validSecret(value: string) {
  const secret = String(process.env.WA_MOVEMENT_CRON_SECRET || '');
  const token = value.replace(/^Bearer\s+/i, '').trim();
  if (secret.length < 16 || token.length !== secret.length) return false;
  return timingSafeEqual(Buffer.from(secret), Buffer.from(token));
}

/** Invocado por agendador privado (Supabase pg_cron/pg_net ou equivalente).
 * Nenhuma fila é iniciada por GET: apenas campanhas já confirmadas são processadas.
 */
export async function GET(request: Request) {
  if (!validSecret(request.headers.get('authorization') || '')) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }
  try {
    return NextResponse.json({ok:true,processed:false,reason:'linked_worker_dispatch_only'}, {
      headers: { 'Cache-Control': 'private, no-store' },
    });
  } catch {
    return NextResponse.json({ ok:false, error:'Falha no processamento da fila' }, { status: 503 });
  }
}

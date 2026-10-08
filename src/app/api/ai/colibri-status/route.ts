import { NextResponse } from 'next/server';
import { getUserContext } from '@/lib/server-db';
import { probeColibri } from '@/lib/ai/colibri';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/** Somente usuários autenticados podem ver o estado do motor.
 * Nunca retorna hostname, token, URL ou credenciais de inferência. */
export async function GET() {
  const ctx = await getUserContext();
  if (!ctx?.auth_id || !ctx?.empresa_id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const state = await probeColibri();
  return NextResponse.json(state, { headers: { 'Cache-Control': 'private, no-store' } });
}

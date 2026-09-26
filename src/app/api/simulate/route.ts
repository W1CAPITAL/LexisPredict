import { NextResponse } from 'next/server';
import { getUserContext } from '@/lib/server-db';
import { simulateScenarios } from '@/lib/simulation/scenario-engine';

export async function POST(req: Request) {
  const ctx = await getUserContext();
  if (!ctx.empresa_id) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });

  try {
    const body = await req.json();
    return NextResponse.json({
      ok: true,
      result: simulateScenarios({
        seed: body?.seed,
        iterations: body?.iterations,
        options: Array.isArray(body?.options) ? body.options : [],
      }),
    });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error?.message || 'Simulação inválida' }, { status: 400 });
  }
}

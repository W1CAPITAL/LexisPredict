import { NextResponse } from 'next/server';
import { getUserContext } from '@/lib/server-db';
import { listPluginStatuses } from '@/lib/plugins/registry';
import { executePlugin } from '@/lib/plugins/runtime';

export async function GET() {
  const ctx = await getUserContext();
  if (!ctx.empresa_id) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });

  return NextResponse.json({
    version: '1.0',
    plugins: listPluginStatuses(),
  });
}

export async function POST(req: Request) {
  const ctx = await getUserContext();
  if (!ctx.empresa_id) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });

  try {
    const body = await req.json();
    const pluginId = String(body?.pluginId || '').trim();
    const action = String(body?.action || '').trim();

    const result = await executePlugin(pluginId, action, body?.input || {}, {
      empresaId: ctx.empresa_id,
      isSuperAdmin: Boolean((ctx as any).isSuperAdmin),
      userId: (ctx as any).auth_id || null,
    });

    return NextResponse.json(result, { status: result.ok ? 200 : 400 });
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: error?.message || 'Payload inválido' },
      { status: 400 }
    );
  }
}

import { NextResponse } from 'next/server';
import { getUserContext } from '@/lib/server-db';
import {
  getComfyHistory,
  getComfyStatus,
  isComfyConfigured,
  queueComfyMedia,
  type ComfyMediaKind,
} from '@/lib/media/comfyui';

export async function GET(req: Request) {
  const ctx = await getUserContext();
  if (!ctx.empresa_id) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });

  const url = new URL(req.url);
  const promptId = url.searchParams.get('prompt_id');
  if (promptId) return NextResponse.json(await getComfyHistory(promptId));

  const status = await getComfyStatus();
  return NextResponse.json({
    ...status,
    imagePreset: isComfyConfigured('image'),
    videoPreset: isComfyConfigured('video'),
  });
}

export async function POST(req: Request) {
  const ctx = await getUserContext();
  if (!ctx.empresa_id) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });

  try {
    const body = await req.json();
    const kind: ComfyMediaKind = body?.kind === 'video' ? 'video' : 'image';
    const customWorkflow =
      body?.workflow && (ctx as any).isSuperAdmin
        ? (body.workflow as Record<string, unknown>)
        : undefined;

    const result = await queueComfyMedia({
      kind,
      prompt: String(body?.prompt || ''),
      negativePrompt: String(body?.negativePrompt || ''),
      width: Number(body?.width),
      height: Number(body?.height),
      frames: Number(body?.frames),
      seed: Number.isFinite(Number(body?.seed)) ? Number(body.seed) : undefined,
      workflow: customWorkflow,
    });

    return NextResponse.json(result, { status: result.ok ? 202 : 400 });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error?.message || 'Payload inválido' }, { status: 400 });
  }
}

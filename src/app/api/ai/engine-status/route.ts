import { NextResponse } from 'next/server';
import { getUserContext } from '@/lib/server-db';
import { probeColibri } from '@/lib/ai/colibri';
import { probeMiniCpm } from '@/lib/ai/minicpm';
import { probeNeedle } from '@/lib/ai/needle-rag';

export const dynamic='force-dynamic';
export const revalidate=0;
export const maxDuration=15;

/** Authenticated status: no hosts, tokens or API keys in responses. */
export async function GET() {
  const ctx=await getUserContext();
  if(!ctx?.auth_id || !ctx?.empresa_id) return NextResponse.json({error:'Unauthorized'},{status:401});
  const [colibri,minicpm,needle]=await Promise.all([probeColibri(),probeMiniCpm(),probeNeedle()]);
  return NextResponse.json({
    colibri,
    minicpm,
    needle,
    localBrowser:{available:'client-side-only',model:'onnx-community/Qwen2.5-0.5B-Instruct'},
  },{headers:{'Cache-Control':'private, no-store'}});
}

import { NextResponse } from 'next/server';
import { listCapabilities } from '@/lib/cognitive/registry';
import { buildCognitivePlan } from '@/lib/cognitive/orchestrator';
import { listCognitiveSources } from '@/lib/cognitive/source-catalog';

export async function GET() {
  return NextResponse.json({
    version: '4.0',
    capabilities: listCapabilities(),
    sources: listCognitiveSources(),
  });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const text = typeof body?.text === 'string' ? body.text : '';
    return NextResponse.json(
      buildCognitivePlan({
        text,
        hasImage: Boolean(body?.hasImage),
        hasDocument: Boolean(body?.hasDocument),
      })
    );
  } catch {
    return NextResponse.json({ error: 'payload inválido' }, { status: 400 });
  }
}

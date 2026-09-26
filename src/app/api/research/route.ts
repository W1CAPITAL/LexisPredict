import { NextResponse } from 'next/server';
import { getUserContext } from '@/lib/server-db';
import { firecrawlScrape, firecrawlSearch, isFirecrawlConfigured } from '@/lib/research/firecrawl';

export async function GET() {
  const ctx = await getUserContext();
  if (!ctx.empresa_id) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  return NextResponse.json({ configured: isFirecrawlConfigured(), provider: 'firecrawl' });
}

export async function POST(req: Request) {
  const ctx = await getUserContext();
  if (!ctx.empresa_id) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });

  try {
    const body = await req.json();
    const action = body?.action === 'scrape' ? 'scrape' : 'search';

    if (action === 'scrape') {
      const result = await firecrawlScrape(String(body?.url || ''));
      return NextResponse.json(result, { status: result.ok ? 200 : 400 });
    }

    const result = await firecrawlSearch(String(body?.query || ''), Number(body?.limit || 5));
    return NextResponse.json(result, { status: result.ok ? 200 : 400 });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error?.message || 'Payload inválido' }, { status: 400 });
  }
}

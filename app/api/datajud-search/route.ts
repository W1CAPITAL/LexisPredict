/**
 * Proxy server-side DataJud — evita CORS do browser.
 * POST { mode: 'cpf'|'nome'|'cnj', query: string, onlyBA?: boolean }
 */
import { NextResponse } from 'next/server';
import {
  searchDataJudByCpf,
  searchDataJudByNome,
  fetchDataJud,
} from '@/lib/datajud';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const mode = String(body.mode || '');
    const query = String(body.query || '').trim();
    const onlyBA = !!body.onlyBA;

    if (!query) {
      return NextResponse.json({ success: false, items: [], error: 'Query vazia' }, { status: 400 });
    }

    if (mode === 'cpf') {
      const res = await searchDataJudByCpf(query, { onlyBA, size: 12 });
      return NextResponse.json(res);
    }
    if (mode === 'nome') {
      const res = await searchDataJudByNome(query, { size: 12 });
      return NextResponse.json(res);
    }
    if (mode === 'cnj') {
      const res = await fetchDataJud(query, 1, { fast: false });
      return NextResponse.json({ success: !res.error, data: res, error: res.message });
    }

    return NextResponse.json({ success: false, error: 'mode inválido' }, { status: 400 });
  } catch (e: any) {
    return NextResponse.json(
      { success: false, items: [], error: e?.message || 'Falha no proxy DataJud' },
      { status: 500 }
    );
  }
}

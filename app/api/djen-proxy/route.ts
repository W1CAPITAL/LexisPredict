/**
 * @fileOverview Proxy DJEN Região Brasil (gru1)
 * Túnel de acesso para contornar geo-block do CloudFront PJe.
 */
import { NextResponse } from 'next/server';
import { fetchDjenComunicacoes } from '@/lib/djen';

export const runtime = 'nodejs';
export const preferredRegion = 'gru1'; // CRÍTICO: São Paulo
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get('Authorization');
    const secret = process.env.DATAJUD_WORKER_SECRET;
    
    // Auth simples via Worker Secret para proteção do túnel
    if (!secret || authHeader !== `Bearer ${secret}`) {
      return new Response('Unauthorized', { status: 401 });
    }

    const body = await request.json();
    const { protocolo, siglaTribunal, dataInicio, dataFim } = body;

    if (!protocolo) return NextResponse.json({ success: false, error: 'Protocolo ausente' }, { status: 400 });

    const result = await fetchDjenComunicacoes(protocolo, {
      siglaTribunal,
      dataInicio,
      dataFim
    });

    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

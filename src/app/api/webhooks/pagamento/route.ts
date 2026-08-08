/**
 * Webhook de pagamento — GRÁTIS / opcional.
 * Não depende de Asaas pago: se LEXIS_WEBHOOK_SECRET estiver no env,
 * um POST autenticado pode marcar crm_receber como pago.
 * Uso futuro com gateway free-tier ou automação própria.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const secret = process.env.LEXIS_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: 'Webhook desativado (defina LEXIS_WEBHOOK_SECRET no Vercel para habilitar).' },
      { status: 503 }
    );
  }
  const hdr = req.headers.get('x-lexis-webhook-secret') || '';
  if (hdr !== secret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    return NextResponse.json({ error: 'Supabase admin não configurado' }, { status: 500 });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }

  const receberId = String(body?.receber_id || body?.id || '').trim();
  const empresaId = String(body?.empresa_id || '').trim();
  if (!receberId || !empresaId) {
    return NextResponse.json({ error: 'receber_id e empresa_id obrigatórios' }, { status: 400 });
  }

  const admin = createClient(url, key, { auth: { persistSession: false } });
  const { error } = await admin
    .from('crm_receber')
    .update({
      status: 'pago',
      pago_em: new Date().toISOString().slice(0, 10),
      forma_pagamento: String(body?.forma || 'webhook'),
    })
    .eq('id', receberId)
    .eq('empresa_id', empresaId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ success: true, receber_id: receberId });
}

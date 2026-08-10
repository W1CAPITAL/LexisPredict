/**
 * Webhook Evolution (WhatsApp) — exige segredo.
 * Headers aceitos: x-lexis-webhook-secret | Authorization: Bearer <secret>
 * Env: LEXIS_WEBHOOK_SECRET ou EVOLUTION_WEBHOOK_SECRET
 */
import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

function unauthorized() {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}

function getSecret() {
  return (
    process.env.LEXIS_WEBHOOK_SECRET ||
    process.env.EVOLUTION_WEBHOOK_SECRET ||
    process.env.WEBHOOK_SECRET ||
    ''
  ).trim();
}

function assertWebhookAuth(request: Request): boolean {
  const secret = getSecret();
  if (!secret) return false;
  const hdr =
    request.headers.get('x-lexis-webhook-secret') ||
    request.headers.get('x-webhook-secret') ||
    '';
  if (hdr && hdr === secret) return true;
  const auth = request.headers.get('authorization') || '';
  if (auth.toLowerCase().startsWith('bearer ') && auth.slice(7).trim() === secret) return true;
  return false;
}

export async function POST(request: Request) {
  try {
    if (!getSecret()) {
      return NextResponse.json(
        { error: 'Webhook desativado (defina LEXIS_WEBHOOK_SECRET no Vercel).' },
        { status: 503 }
      );
    }
    if (!assertWebhookAuth(request)) return unauthorized();

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json({ error: 'Config Error' }, { status: 500 });
    }

    const payload = await request.json();

    if (payload.event !== 'MESSAGES_UPSERT') {
      return NextResponse.json({ status: 'ignored' });
    }

    const data = payload.data;
    if (!data || !data.message) return NextResponse.json({ status: 'no_data' });

    const remoteJid = data.key?.remoteJid || '';
    let contactNumber = remoteJid.split('@')[0].replace(/\D/g, '');

    if (contactNumber.length === 10 || contactNumber.length === 11) {
      contactNumber = `55${contactNumber}`;
    }

    const message = data.message;
    const messageText =
      message.conversation ||
      message.extendedTextMessage?.text ||
      message.imageMessage?.caption ||
      message.videoMessage?.caption ||
      '';

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false },
    });

    const { error } = await supabase.from('whatsapp_messages').insert({
      instance_name: payload.instance || 'Lexis',
      contact_number: contactNumber,
      contact_name: data.pushName || 'Contato WhatsApp',
      message_id: data.key?.id || '',
      message_text: messageText,
      from_me: data.key?.fromMe || false,
      timestamp: new Date(
        Number(data.messageTimestamp || Date.now() / 1000) * 1000
      ).toISOString(),
      raw_payload: payload,
    });

    if (error) {
      console.error('[Webhook Error]', error.message);
      return NextResponse.json({ error: 'Insert failed' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
  }
}

/**
 * Webhook Evolution → Supabase whatsapp_messages
 * Headers: x-lexis-webhook-secret | Authorization: Bearer <LEXIS_WEBHOOK_SECRET>
 * Aceita eventos: MESSAGES_UPSERT | messages.upsert | MESSAGES_SET
 */
import { NextResponse } from 'next/server';
import { persistWhatsAppMessage, normalizeBrPhone } from '@/lib/whatsapp-persist';

export const runtime = 'nodejs';

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
  if (auth.toLowerCase().startsWith('bearer ') && auth.slice(7).trim() === secret) {
    return true;
  }
  // Alguns painéis Evolution só mandam query ?secret=
  return false;
}

function extractText(message: any): string {
  if (!message) return '';
  return (
    message.conversation ||
    message.extendedTextMessage?.text ||
    message.imageMessage?.caption ||
    message.videoMessage?.caption ||
    message.documentMessage?.caption ||
    message.buttonsResponseMessage?.selectedDisplayText ||
    message.listResponseMessage?.title ||
    ''
  );
}

function normalizeEvent(ev: any): string {
  return String(ev || '')
    .toLowerCase()
    .replace(/[.\s-]/g, '_');
}

export async function POST(request: Request) {
  try {
    if (!getSecret()) {
      return NextResponse.json(
        { error: 'Webhook desativado (defina LEXIS_WEBHOOK_SECRET no Vercel).' },
        { status: 503 }
      );
    }
    if (!assertWebhookAuth(request)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = await request.json();
    const eventName = normalizeEvent(payload.event || payload.type || payload.Event);
    const isMsg =
      eventName.includes('messages_upsert') ||
      eventName.includes('message_upsert') ||
      eventName.includes('messages_set') ||
      eventName === 'messagesupsert';

    if (!isMsg) {
      return NextResponse.json({ status: 'ignored', event: eventName });
    }

    // Evolution às vezes manda data como objeto ou array
    const rawData = payload.data ?? payload.message ?? payload;
    const items = Array.isArray(rawData) ? rawData : [rawData];

    let saved = 0;
    const errors: string[] = [];

    for (const data of items) {
      if (!data) continue;
      const key = data.key || data.Key || {};
      const remoteJid = String(key.remoteJid || data.remoteJid || '');
      if (remoteJid.includes('@g.us')) continue; // ignora grupos

      let contactNumber = remoteJid.split('@')[0].replace(/\D/g, '');
      if (!contactNumber && data.participant) {
        contactNumber = String(data.participant).replace(/\D/g, '');
      }
      contactNumber = normalizeBrPhone(contactNumber);

      const message = data.message || data.Message || {};
      const messageText = extractText(message);
      if (!messageText) continue;

      const tsSec = Number(data.messageTimestamp || data.message_timestamp || Date.now() / 1000);
      const res = await persistWhatsAppMessage({
        contactNumber,
        messageText,
        fromMe: !!(key.fromMe ?? data.fromMe),
        messageId: key.id || data.id || undefined,
        contactName: data.pushName || data.pushname || undefined,
        remoteJid: remoteJid || undefined,
        instanceName: payload.instance || payload.instanceName || process.env.EVOLUTION_INSTANCE,
        source: 'evolution-webhook',
        timestamp: new Date(tsSec * 1000).toISOString(),
        raw: { event: payload.event, key },
      });
      if (res.ok) saved += 1;
      else if (res.error) errors.push(res.error);
    }

    if (saved === 0 && errors.length) {
      return NextResponse.json({ error: errors[0], saved: 0 }, { status: 500 });
    }

    return NextResponse.json({ success: true, saved });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || 'Internal Error' },
      { status: 500 }
    );
  }
}

/** Health: GET mostra se secret e supabase estão configurados (sem vazar valores). */
export async function GET() {
  const hasSecret = Boolean(getSecret());
  const hasSb = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
  );
  return NextResponse.json({
    ok: hasSecret && hasSb,
    webhookSecret: hasSecret,
    supabase: hasSb,
    hint: !hasSecret
      ? 'Defina LEXIS_WEBHOOK_SECRET no Vercel'
      : !hasSb
        ? 'Defina SUPABASE_SERVICE_ROLE_KEY'
        : 'POST com header x-lexis-webhook-secret + evento messages.upsert',
  });
}

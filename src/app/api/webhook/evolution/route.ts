/**
 * Webhook Evolution (WhatsApp) — exige segredo.
 * Headers aceitos: x-lexis-webhook-secret | Authorization: Bearer <secret>
 * Env: LEXIS_WEBHOOK_SECRET ou EVOLUTION_WEBHOOK_SECRET
 */
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
  // 1) Header (se a Evolution tiver)
  const hdr =
    request.headers.get('x-lexis-webhook-secret') ||
    request.headers.get('x-webhook-secret') ||
    '';
  if (hdr && hdr === secret) return true;
  // 2) Authorization: Bearer
  const auth = request.headers.get('authorization') || '';
  if (auth.toLowerCase().startsWith('bearer ') && auth.slice(7).trim() === secret) return true;
  // 3) Senha na URL (mais fácil — sem campo Header na Evolution)
  //    Ex: https://seu-app.vercel.app/api/webhook/evolution?secret=SUA_SENHA
  try {
    const url = new URL(request.url);
    const q =
      url.searchParams.get('secret') ||
      url.searchParams.get('token') ||
      url.searchParams.get('apikey') ||
      '';
    if (q && q === secret) return true;
  } catch {
    /* ignore */
  }
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

    const payload = await request.json();

    const ev = String(payload.event || payload.type || '').toLowerCase().replace(/[.-]/g, '_');
    if (!ev.includes('messages_upsert') && !ev.includes('message_upsert') && ev !== 'messagesupsert') {
      return NextResponse.json({ status: 'ignored', event: payload.event });
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

    // Tenant is resolved only from server-controlled instance configuration;
    // never trust an empresa_id supplied by a public webhook payload.
    const boundCompany=String(process.env.WA_DAILY_WEBHOOK_EMPRESA_ID||'').trim();
    const boundInstance=String(process.env.WA_DAILY_WEBHOOK_INSTANCE||process.env.EVOLUTION_INSTANCE||'').trim();
    const instance=String(payload.instance||'');
    const company=(boundCompany && boundInstance && instance===boundInstance)
      ? boundCompany : null;
    // No WhatsApp transcript, payload, or text is persisted in Supabase.
    // Only the explicit SAIR preference may be recorded for this verified tenant.
    if(company && data.key?.fromMe!==true && messageText.trim()){
      try {
        const {noteInboundPreference}=await import('@/lib/wa-contact-privacy');
        const optedOut=await noteInboundPreference(company,contactNumber,messageText);
        if(optedOut){
          return NextResponse.json({success:true,returnAutomation:{processed:false,reason:'opt_out'}});
        }
        const {processIncomingReturnRequest}=await import('@/lib/wa-daily-return-service');
        const result=await processIncomingReturnRequest(company,contactNumber,messageText);
        return NextResponse.json({success:true,returnAutomation:{processed:result.sent===true,reason:result.reason}});
      } catch {
        // Fail closed if opt-out storage or downstream processing is unavailable.
        // Do not reintroduce transcript persistence to recover from a webhook error.
        return NextResponse.json({success:false,returnAutomation:{processed:false,reason:'privacy_or_queue_unavailable'}},{status:503});
      }
    }
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
  }
}

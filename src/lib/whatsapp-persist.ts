/**
 * Persistência de mensagens WhatsApp no SUPABASE (tabela whatsapp_messages).
 * Não usa o Postgres da Evolution — só o banco do Lexis.
 */
import { createClient } from '@supabase/supabase-js';
import { normalizeBrPhone, phoneMatchVariants } from '@/lib/evolution-api';

export type WaPersistInput = {
  contactNumber: string;
  messageText: string;
  fromMe: boolean;
  messageId?: string;
  contactName?: string;
  remoteJid?: string;
  instanceName?: string;
  source?: string;
  timestamp?: string;
  empresaId?: string | null;
  raw?: any;
};

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_KEY ||
    '';
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

export async function persistWhatsAppMessage(input: WaPersistInput): Promise<{
  ok: boolean;
  error?: string;
}> {
  const sb = adminClient();
  if (!sb) return { ok: false, error: 'Supabase service role ausente' };

  let num = normalizeBrPhone(input.contactNumber);
  if (!num || num.length < 10) {
    return { ok: false, error: 'Telefone inválido' };
  }
  const text = String(input.messageText || '').trim();
  if (!text) return { ok: false, error: 'Mensagem vazia' };

  const row: Record<string, any> = {
    contact_number: num,
    phone: num,
    contact_name: input.contactName || null,
    remote_jid: input.remoteJid || `${num}@s.whatsapp.net`,
    message_id: input.messageId || `lexis-${Date.now()}`,
    message_text: text,
    body: text,
    from_me: !!input.fromMe,
    direction: input.fromMe ? 'out' : 'in',
    source: input.source || (input.fromMe ? 'lexis-send' : 'evolution-webhook'),
    instance_name: input.instanceName || process.env.EVOLUTION_INSTANCE || 'Lexis',
    timestamp: input.timestamp || new Date().toISOString(),
    raw_payload: input.raw || null,
  };
  if (input.empresaId) row.empresa_id = input.empresaId;

  const { error } = await sb.from('whatsapp_messages').insert(row);
  if (error) {
    // tenta sem colunas opcionais (schema mínimo)
    const minimal = {
      contact_number: num,
      message_text: text,
      from_me: !!input.fromMe,
      timestamp: row.timestamp,
      message_id: row.message_id,
    };
    const { error: e2 } = await sb.from('whatsapp_messages').insert(minimal);
    if (e2) return { ok: false, error: e2.message || error.message };
  }
  return { ok: true };
}

export { phoneMatchVariants, normalizeBrPhone };

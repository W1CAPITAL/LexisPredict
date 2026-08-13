/**
 * Persistência WhatsApp → Supabase (tabela whatsapp_messages).
 */
import { createClient } from '@supabase/supabase-js';
import { normalizeBrPhone } from '@/lib/evolution-api';

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
  id?: string;
}> {
  const sb = adminClient();
  if (!sb) {
    return {
      ok: false,
      error:
        'Falta SUPABASE_SERVICE_ROLE_KEY na Vercel (Settings → API → service_role, não anon).',
    };
  }

  const num = normalizeBrPhone(input.contactNumber);
  if (!num || num.length < 10) {
    return { ok: false, error: 'Telefone inválido para gravar (confira DDD no cadastro).' };
  }
  const text = String(input.messageText || '').trim();
  if (!text) return { ok: false, error: 'Mensagem vazia' };

  const ts = input.timestamp || new Date().toISOString();
  const mid = input.messageId || `lexis-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  // Tentativa 1: schema completo
  const full: Record<string, any> = {
    contact_number: num,
    phone: num,
    contact_name: input.contactName || null,
    remote_jid: input.remoteJid || `${num}@s.whatsapp.net`,
    message_id: mid,
    message_text: text,
    body: text,
    from_me: !!input.fromMe,
    direction: input.fromMe ? 'out' : 'in',
    source: input.source || (input.fromMe ? 'lexis-send' : 'evolution-webhook'),
    instance_name: input.instanceName || process.env.EVOLUTION_INSTANCE || 'Lexis',
    timestamp: ts,
  };
  if (input.empresaId) full.empresa_id = input.empresaId;
  if (input.raw) full.raw_payload = input.raw;

  let { data, error } = await sb.from('whatsapp_messages').insert(full).select('id').maybeSingle();

  if (error) {
    // Tentativa 2: mínimo
    const minimal: Record<string, any> = {
      contact_number: num,
      message_text: text,
      from_me: !!input.fromMe,
      timestamp: ts,
      message_id: mid,
    };
    const r2 = await sb.from('whatsapp_messages').insert(minimal).select('id').maybeSingle();
    if (r2.error) {
      return {
        ok: false,
        error: r2.error.message || error.message,
      };
    }
    return { ok: true, id: r2.data?.id };
  }
  return { ok: true, id: data?.id };
}

export async function fetchMessagesByPhone(phone: string): Promise<{
  messages: any[];
  error?: string;
}> {
  const sb = adminClient();
  if (!sb) return { messages: [], error: 'Sem service role' };
  const num = normalizeBrPhone(phone);
  if (!num) return { messages: [], error: 'Telefone vazio' };
  const variants = [num];
  if (num.startsWith('55') && num.length >= 12) variants.push(num.slice(2));
  else if (num.length >= 10 && num.length <= 11) variants.push(`55${num}`);

  // 1) Match EXATO no número do cliente (evita misturar conversas)
  let { data, error } = await sb
    .from('whatsapp_messages')
    .select('*')
    .or(
      [
        ...variants.map((v) => `contact_number.eq.${v}`),
        ...variants.map((v) => `phone.eq.${v}`),
      ].join(',')
    )
    .order('timestamp', { ascending: true })
    .limit(300);

  if (error) return { messages: [], error: error.message };

  // 2) Se vazio, fallback controlado só por últimos 11 dígitos (não 8 — evita cruzar números)
  if (!data?.length) {
    const last11 = num.slice(-11);
    const r2 = await sb
      .from('whatsapp_messages')
      .select('*')
      .or(`contact_number.ilike.%${last11},phone.ilike.%${last11}`)
      .order('timestamp', { ascending: true })
      .limit(300);
    if (!r2.error && r2.data?.length) {
      // filtra de novo no app: deve terminar com os mesmos 10–11 dígitos
      data = r2.data.filter((row: any) => {
        const d = String(row.contact_number || row.phone || '').replace(/\D/g, '');
        return d.endsWith(num.slice(-10)) || d.endsWith(num.slice(-11));
      });
    }
  }

  return { messages: data || [] };
}

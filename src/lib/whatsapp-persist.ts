/**
 * Persistência WhatsApp → Supabase (tabela whatsapp_messages).
 */
import { getWaReadClients, getWaWriteClient, shouldStoreWhatsAppRaw } from '@/lib/dual-db-routing';
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

export async function persistWhatsAppMessage(input: WaPersistInput): Promise<{
  ok: boolean;
  error?: string;
  id?: string;
}> {
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
  if (input.raw && shouldStoreWhatsAppRaw()) full.raw_payload = input.raw;
  let sb;
  try {
    sb = getWaWriteClient(num).client;
  } catch (err: any) {
    return { ok: false, error: err?.message || 'Erro de configuração dos bancos' };
  }

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

/** Mesma linha BR? (55, 9º dígito, formatação). */
export function sameWhatsAppLine(stored: string, targetNormalized: string): boolean {
  const a = String(stored || '').replace(/\D/g, '');
  const b = String(targetNormalized || '').replace(/\D/g, '');
  if (!a || a.length < 8 || !b || b.length < 10) return false;
  if (a === b) return true;
  if (a.endsWith(b) || b.endsWith(a)) return true;
  const b10 = b.slice(-10);
  const b11 = b.slice(-11);
  if (a.endsWith(b10) || a.endsWith(b11)) return true;
  // com/sem 9 após DDD (ex.: 2799630… vs 279630…)
  if (b.startsWith('55') && b.length >= 12) {
    const local = b.slice(2);
    if (local.length === 11 && local[2] === '9') {
      const sem9 = local.slice(0, 2) + local.slice(3);
      if (a.endsWith(sem9) || a.endsWith('55' + sem9)) return true;
    }
    if (local.length === 10) {
      const com9 = local.slice(0, 2) + '9' + local.slice(2);
      if (a.endsWith(com9) || a.endsWith('55' + com9)) return true;
    }
  }
  return false;
}

export async function fetchMessagesByPhone(phone: string): Promise<{
  messages: any[];
  error?: string;
}> {
  let clients;
  try {
    clients = getWaReadClients();
  } catch (err: any) {
    return { messages: [], error: err?.message || 'Bancos indisponíveis' };
  }
  const num = normalizeBrPhone(phone);
  if (!num) return { messages: [], error: 'Telefone vazio' };

  let variants: string[] = [num];
  try {
    const { phoneMatchVariants } = await import('@/lib/evolution-api');
    variants = phoneMatchVariants(phone);
    if (!variants.includes(num)) variants.unshift(num);
  } catch {
    if (num.startsWith('55') && num.length >= 12) variants.push(num.slice(2));
    else if (num.length >= 10 && num.length <= 11) variants.push(`55${num}`);
  }

  const last10 = num.slice(-10);
  const last11 = num.slice(-11);
  const orParts: string[] = [];
  for (const v of variants) {
    orParts.push(`contact_number.eq.${v}`);
    orParts.push(`phone.eq.${v}`);
    orParts.push(`remote_jid.eq.${v}@s.whatsapp.net`);
    orParts.push(`remote_jid.ilike.${v}@%`);
  }
  // legado: gravado com máscara / parcial
  orParts.push(`contact_number.ilike.%${last10}%`);
  orParts.push(`phone.ilike.%${last10}%`);
  orParts.push(`remote_jid.ilike.%${last10}%`);
  if (last11 !== last10) {
    orParts.push(`contact_number.ilike.%${last11}%`);
    orParts.push(`phone.ilike.%${last11}%`);
    orParts.push(`remote_jid.ilike.%${last11}%`);
  }

  // Both shards queried concurrently, including historical primary rows during migration.
  // A failed shard is reported, never silently interpreted as empty history.
  const results = await Promise.all(clients.map(async ({ client, shard }) => {
    let { data, error } = await client
      .from('whatsapp_messages')
      .select('*')
      .or(orParts.join(','))
      .order('timestamp', { ascending: false })
      .limit(800);
    if (error && /timestamp|column/i.test(error.message)) {
      const retry = await client
        .from('whatsapp_messages')
        .select('*')
        .or(orParts.join(','))
        .order('created_at', { ascending: false })
        .limit(800);
      data = retry.data;
      error = retry.error;
    }
    return { shard, data: data || [], error };
  }));
  const failures = results.filter(r => r.error);
  if (failures.length === results.length) {
    return { messages: [], error: failures.map(r => r.shard + ': ' + r.error?.message).join('; ') };
  }
  const data = results.flatMap(r => r.data);
  const partialError = failures.length
    ? 'Histórico parcial: ' + failures.map(r => r.shard + ': ' + r.error?.message).join('; ')
    : undefined;

  const filtered = (data || []).filter((row: any) => {
    const candidates = [
      row.contact_number,
      row.phone,
      row.remote_jid,
      row.remoteJid,
    ];
    return candidates.some((c) => sameWhatsAppLine(String(c || ''), num));
  });

  // Ordena por data (timestamp ou created_at)
  // A message can exist in both databases during a non-destructive migration.
  const seen = new Set<string>();
  const unique = filtered.filter((row: any) => {
    const id = String(row.message_id || '');
    const key = id
      ? [row.empresa_id || '', row.instance_name || '', id].join('|')
      : [row.empresa_id || '', row.contact_number || '', row.timestamp || '', row.message_text || row.body || '', row.from_me || false].join('|');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  unique.sort((a: any, b: any) => {
    const ta = new Date(a.timestamp || a.created_at || 0).getTime();
    const tb = new Date(b.timestamp || b.created_at || 0).getTime();
    return ta - tb;
  });

  return { messages: unique.slice(-800), error: partialError };
}

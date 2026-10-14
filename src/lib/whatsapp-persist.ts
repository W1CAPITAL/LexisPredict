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

  // Service-role writes MUST have a verified tenant. Legacy unscoped records
  // are not attached automatically: do not guess an owner by phone number.
  if (!input.empresaId || !/^[0-9a-f-]{36}$/i.test(String(input.empresaId))) {
    return {ok:false,error:'Empresa autenticada obrigatória para armazenar o histórico.'};
  }
  const num = normalizeBrPhone(input.contactNumber);
  if (!num || num.length < 10) {
    return { ok: false, error: 'Telefone inválido para gravar (confira DDD no cadastro).' };
  }
  const text = String(input.messageText || '').trim();
  if (!text) return { ok: false, error: 'Mensagem vazia' };

  // Conteúdos de conversas não são armazenados. Apenas SAIR permanece.
  if(!input.fromMe && /^(SAIR|STOP|PARE)[.!? ]*$/i.test(text)){
    const n=String(num).replace(/[^0-9]/g,'');
    const phone=n.length===10||n.length===11?'55'+n:n;
    if(/^55[0-9]{10,11}$/.test(phone)){
      const {error}=await sb.from('wa_contact_optouts').upsert({
        empresa_id:input.empresaId,phone,opted_out_at:new Date().toISOString()
      },{onConflict:'empresa_id,phone'});
      if(error)return {ok:false,error:'Falha ao registrar SAIR'};
    }
  }
  return {ok:true};
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

export async function fetchMessagesByPhone(phone: string, empresaId?: string): Promise<{
  messages: any[];
  error?: string;
}> {
  const sb = adminClient();
  if (!sb) return { messages: [], error: 'Sem service role' };
  const num = normalizeBrPhone(phone);
  if (!num) return { messages: [], error: 'Telefone vazio' };
  if (!empresaId || !/^[0-9a-f-]{36}$/i.test(empresaId)) {
    return {messages: [], error: 'Escopo de empresa obrigatório para ler histórico.'};
  }

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

  // Busca ampla + filtro local (não perde histórico antigo com formato diferente)
  let { data, error } = await sb
    .from('whatsapp_messages')
    .select('*')
    .eq('empresa_id', empresaId)
    .or(orParts.join(','))
    .order('timestamp', { ascending: true })
    .limit(800);

  // Se timestamp null em msgs antigas, tenta created_at
  if (error) {
    const r = await sb
      .from('whatsapp_messages')
      .select('*')
      .eq('empresa_id', empresaId)
      .or(orParts.join(','))
      .order('created_at', { ascending: true })
      .limit(800);
    data = r.data;
    error = r.error;
  }

  if (error) return { messages: [], error: error.message };

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
  filtered.sort((a: any, b: any) => {
    const ta = new Date(a.timestamp || a.created_at || 0).getTime();
    const tb = new Date(b.timestamp || b.created_at || 0).getTime();
    return ta - tb;
  });

  return { messages: filtered };
}

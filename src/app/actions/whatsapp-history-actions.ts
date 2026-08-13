'use server';

/**
 * Histórico WhatsApp — limpar e importar com validação de número.
 */
import { normalizeBrPhone } from '@/lib/evolution-api';
import { createClient } from '@/lib/supabase/server';

function digitsOnly(s: string) {
  return String(s || '').replace(/\D/g, '');
}

/** Apaga mensagens deste telefone no Supabase (exact + variações 55…). */
export async function clearWhatsAppHistoryAction(phone: string): Promise<{
  success: boolean;
  deleted?: number;
  error?: string;
  phone?: string;
}> {
  try {
    const n = normalizeBrPhone(phone);
    if (!n) return { success: false, error: 'Telefone vazio' };

    const variants = new Set<string>([n]);
    if (n.startsWith('55') && n.length >= 12) {
      variants.add(n.slice(2));
    } else if (n.length >= 10 && n.length <= 11) {
      variants.add(`55${n}`);
    }

    const supabase = await createClient();
    // Prefer service role via persist admin if available
    let client: any = supabase;
    try {
      const { getSupabaseAdmin } = await import('@/lib/server-db');
      const admin = await getSupabaseAdmin();
      if (admin) client = admin;
    } catch {
      /* use user client */
    }

    const list = Array.from(variants);
    let deleted = 0;
    for (const col of ['contact_number', 'phone'] as const) {
      const { data, error } = await client
        .from('whatsapp_messages')
        .delete()
        .in(col, list)
        .select('id');
      if (error && !String(error.message || '').includes('does not exist')) {
        // tenta próximo
        continue;
      }
      deleted += Array.isArray(data) ? data.length : 0;
    }

    // fallback: delete by last 11 digits match only on contact_number eq exact variants
    return { success: true, deleted, phone: n };
  } catch (e: any) {
    return { success: false, error: e?.message || 'Falha ao limpar histórico' };
  }
}

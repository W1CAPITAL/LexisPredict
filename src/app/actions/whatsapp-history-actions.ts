'use server';

/**
 * Histórico WhatsApp — limpar e importar com validação de número.
 */
import { normalizeBrPhone } from '@/lib/evolution-api';
import { getWaReadClients } from '@/lib/dual-db-routing';
import { getUserContext } from '@/lib/server-db';

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

    // Service-role deletes must be explicitly tenant scoped and authenticated.
    const ctx = await getUserContext();
    if (!ctx.empresa_id || !ctx.auth_id) return { success: false, error: 'Sessão ou empresa não autorizada' };
    const clients = getWaReadClients();
    const list = Array.from(variants);
    const perShard = await Promise.all(clients.map(async ({ client, shard }) => {
      let removed = 0;
      const errors: string[] = [];
      for (const col of ['contact_number', 'phone'] as const) {
        const { data, error } = await client
          .from('whatsapp_messages')
          .delete()
          .eq('empresa_id', ctx.empresa_id)
          .in(col, list)
          .select('id');
        if (error) {
          if (!/column .* does not exist/i.test(error.message)) errors.push(shard + ': ' + error.message);
        } else {
          removed += data?.length || 0;
        }
      }
      return { removed, errors };
    }));
    const deleted = perShard.reduce((sum, row) => sum + row.removed, 0);
    const failures = perShard.flatMap(row => row.errors);
    if (failures.length) return { success: false, deleted, error: failures.join('; '), phone: n };

    // fallback: delete by last 11 digits match only on contact_number eq exact variants
    return { success: true, deleted, phone: n };
  } catch (e: any) {
    return { success: false, error: e?.message || 'Falha ao limpar histórico' };
  }
}

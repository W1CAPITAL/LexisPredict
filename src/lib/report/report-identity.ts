import 'server-only';
import { cache } from 'react';
import { getSupabaseAdmin, getUserContext } from '@/lib/server-db';

/** No tenant ID accepted from the browser or from a PDF request. */
export const getReportIdentity = cache(async () => {
  const ctx = await getUserContext();
  if (!ctx.empresa_id || !ctx.auth_id) throw new Error('Sessão necessária para identificar o relatório.');
  const db = await getSupabaseAdmin();
  const { data, error } = await db.from('empresas').select('nome').eq('id', ctx.empresa_id).maybeSingle();
  return {
    company: !error && data?.nome ? String(data.nome) : 'Empresa vinculada',
    author: String(ctx.nome || 'Colaborador'),
  };
});

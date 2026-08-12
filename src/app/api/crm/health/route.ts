import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/server-db';

export const dynamic = 'force-dynamic';

/** Health do CRM (tabelas essenciais). Sem dados sensíveis. */
export async function GET() {
  const tables = ['crm_negocios', 'crm_receber', 'crm_pagar', 'crm_servicos', 'crm_atividades', 'crm_tarefas'];
  const status: Record<string, string> = {};
  try {
    const admin = await getSupabaseAdmin();
    for (const t of tables) {
      const { error } = await admin.from(t).select('id').limit(1);
      status[t] = error ? (error.message.includes('exist') || error.code === '42P01' ? 'missing' : 'error') : 'ok';
    }
    return NextResponse.json({ success: true, status, ts: new Date().toISOString() });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message }, { status: 500 });
  }
}

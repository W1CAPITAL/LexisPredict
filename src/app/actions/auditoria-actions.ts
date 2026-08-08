'use server';

/**
 * Auditoria (F1) — logs de ações, exportações, logins e clientes.
 * Reúne auditoria_logs_app + auditoria_logins, com filtros e export XLSX.
 * Acesso restrito a Administrador/Supervisor/Superadmin.
 * @copyright 2026 Davi Alves Figueredo / W1 Capital Assessoria Financeira Ltda.
 */

import { buildXlsxWithSheetJS } from '@/lib/sheetjs-bridge';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { getUserContext } from '@/lib/server-db';
import { isAdminGroup } from '@/lib/roles';

export async function registrarLoginAction(email?: string) {
  try {
    if (!isSupabaseConfigured || !supabase) return { success: false as const };
    const emailClean = String(email || '').toLowerCase().trim();

    let empresa_id: string | null = null;
    let user_nome: string | null = null;
    if (emailClean) {
      const { data } = await supabase
        .from('usuarios')
        .select('empresa_id, nome')
        .eq('email', emailClean)
        .maybeSingle();
      empresa_id = data?.empresa_id || null;
      user_nome = data?.nome || null;
    }
    if (!empresa_id) {
      const ctx = await getUserContext();
      empresa_id = ctx?.empresa_id || null;
    }
    if (!empresa_id) return { success: false as const };

    const { error } = await supabase
      .from('auditoria_logins')
      .insert({ empresa_id, email: emailClean || null, user_nome });
    if (error) throw error;
    return { success: true as const };
  } catch (e: any) {
    console.warn('[registrarLogin]', e?.message);
    return { success: false as const };
  }
}

export interface AuditoriaFiltros {
  q?: string;
  acao?: string;
  inicio?: string;
  fim?: string;
  tipo?: 'acao' | 'login' | 'todos';
}

export async function fetchAuditoriaCompletaAction(filtros?: AuditoriaFiltros) {
  try {
    const ctx = await getUserContext();
    if (!ctx?.empresa_id) return { success: false as const, error: 'Sessão não identificada.' };
    if (!isAdminGroup(ctx?.cargo)) return { success: false as const, error: 'Acesso restrito a Administrador/Supervisor/Superadmin.' };
    if (!isSupabaseConfigured || !supabase) return { success: false as const, error: 'Supabase não configurado.' };

    const f = filtros || {};
    let q = supabase.from('auditoria_logs_app').select('*').eq('empresa_id', ctx.empresa_id);
    if (f.acao) q = q.eq('action', f.acao);
    if (f.inicio) q = q.gte('created_at', `${f.inicio}T00:00:00`);
    if (f.fim) q = q.lte('created_at', `${f.fim}T23:59:59`);
    if (f.q) {
      const termo = String(f.q).replace(/'/g, "''");
      q = q.or(`user_nome.ilike.%${termo}%,protocolo_ref.ilike.%${termo}%`);
    }
    q = q.order('created_at', { ascending: false }).limit(2000);
    const { data: app, error: e1 } = await q;
    if (e1) throw e1;

    let ql = supabase.from('auditoria_logins').select('*').eq('empresa_id', ctx.empresa_id);
    if (f.inicio) ql = ql.gte('created_at', `${f.inicio}T00:00:00`);
    if (f.fim) ql = ql.lte('created_at', `${f.fim}T23:59:59`);
    if (f.q) {
      const termo = String(f.q).replace(/'/g, "''");
      ql = ql.or(`user_nome.ilike.%${termo}%,email.ilike.%${termo}%`);
    }
    ql = ql.order('created_at', { ascending: false }).limit(1000);
    const { data: logins, error: e2 } = await ql;
    if (e2) throw e2;

    const rows = [
      ...(app || []).map((r: any) => ({
        tipo: 'acao' as const,
        created_at: r.created_at,
        usuario: r.user_nome || '—',
        email: '',
        acao: r.action || '—',
        alvo: r.protocolo_ref || '',
        detalhes: r.detalhes || null,
      })),
      ...(logins || []).map((r: any) => ({
        tipo: 'login' as const,
        created_at: r.created_at,
        usuario: r.user_nome || '—',
        email: r.email || '',
        acao: 'login',
        alvo: 'Acesso ao sistema',
        detalhes: null,
      })),
    ]
      .filter((r) => !f.tipo || f.tipo === 'todos' || r.tipo === f.tipo)
      .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));

    const acoes = [...new Set([...(app || []).map((r: any) => r.action), 'login'])].filter(Boolean);
    return { success: true as const, rows, acoes };
  } catch (e: any) {
    console.warn('[fetchAuditoriaCompleta]', e?.message);
    return { success: false as const, error: e?.message || 'Falha ao listar auditoria.' };
  }
}

export async function exportarAuditoriaXlsxAction(filtros?: AuditoriaFiltros) {
  try {
    const res = await fetchAuditoriaCompletaAction(filtros);
    if (!res.success) return { success: false as const, error: res.error };

    const headers = ['Data/Hora', 'Tipo', 'Usuário', 'E-mail', 'Ação', 'Alvo', 'Detalhes'];
    const aoa = (res.rows || []).map((r: any) => [
      r.created_at ? new Date(r.created_at).toLocaleString('pt-BR') : '',
      r.tipo === 'login' ? 'Login' : 'Ação',
      r.usuario,
      r.email,
      r.acao,
      r.alvo,
      r.detalhes ? JSON.stringify(r.detalhes) : '',
    ]);
    const u8 = await buildXlsxWithSheetJS([{ name: 'Auditoria', rows: [headers, ...aoa] }]);
    return {
      success: true as const,
      base64: Buffer.from(u8).toString('base64'),
      filename: `auditoria-${new Date().toISOString().slice(0, 10)}.xlsx`,
      mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    };
  } catch (e: any) {
    console.warn('[exportarAuditoriaXlsx]', e?.message);
    return { success: false as const, error: e?.message || 'Falha ao exportar auditoria.' };
  }
}

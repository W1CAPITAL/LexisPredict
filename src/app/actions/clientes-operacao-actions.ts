'use server';

/**
 * Persistência de Clientes de Operação (Revisional + Jurídico) no Supabase.
 * Todas as gravações passam pelo servidor com escopo rígido por empresa_id.
 */

import {
  getUserContext,
  getSupabaseAdmin,
  registrarAuditoriaAction,
} from '@/lib/server-db';
import { isAdminGroup } from '@/lib/roles';

export type ClienteOperacaoTipo = 'revisional' | 'juridico';

export interface ClienteOperacaoInput {
  tipo: ClienteOperacaoTipo;
  cliente: string;
  banco?: string;
  protocolo?: string;
  dados?: Record<string, unknown> | null;
  id?: string;
}

async function actorName(authId?: string | null) {
  if (!authId) return null;
  try {
    const admin = await getSupabaseAdmin();
    const { data } = await admin
      .from('usuarios')
      .select('nome')
      .eq('auth_user_id', authId)
      .maybeSingle();
    return data?.nome || null;
  } catch {
    return null;
  }
}

export async function listarClientesOperacaoAction(
  tipo: ClienteOperacaoTipo | 'todos' = 'todos'
) {
  try {
    const ctx = await getUserContext();
    if (!ctx?.empresa_id) {
      return { success: false as const, error: 'Sessão não identificada.' };
    }

    const admin = await getSupabaseAdmin();
    let query = admin
      .from('clientes_operacao')
      .select('*')
      .eq('empresa_id', ctx.empresa_id);

    if (tipo && tipo !== 'todos') query = query.eq('tipo', tipo);

    const { data, error } = await query
      .order('updated_at', { ascending: false })
      .limit(200);

    if (error) throw error;
    return { success: true as const, items: data || [] };
  } catch (e: any) {
    console.warn('[listarClientesOperacao]', e?.message);
    return {
      success: false as const,
      error: e?.message || 'Falha ao listar clientes.',
    };
  }
}

export async function salvarClienteOperacaoAction(input: ClienteOperacaoInput) {
  try {
    const ctx = await getUserContext();
    const empresaId = ctx?.empresa_id;

    if (!empresaId) {
      return { success: false as const, error: 'Sessão não identificada.' };
    }

    const cliente = String(input.cliente || '').trim();
    if (!cliente) {
      return { success: false as const, error: 'Informe o nome do cliente.' };
    }

    const admin = await getSupabaseAdmin();
    const nome = await actorName(ctx.auth_id || null);
    const payload = {
      empresa_id: empresaId,
      tipo: input.tipo,
      cliente: cliente.slice(0, 200),
      nome: cliente.slice(0, 200), // compatibilidade com schema legado
      banco: String(input.banco || '').slice(0, 200) || null,
      protocolo: String(input.protocolo || '').slice(0, 200) || null,
      dados: input.dados || {},
      edited_by_name: nome,
      updated_at: new Date().toISOString(),
    };

    let rowId: string | null = input.id || null;

    if (!rowId) {
      let q = admin
        .from('clientes_operacao')
        .select('id')
        .eq('empresa_id', empresaId)
        .eq('tipo', input.tipo)
        .eq('cliente', payload.cliente);

      if (payload.protocolo) q = q.eq('protocolo', payload.protocolo);

      const { data: existente, error: lookupError } = await q.maybeSingle();
      if (lookupError) throw lookupError;
      rowId = existente?.id || null;
    }

    if (rowId) {
      const { error } = await admin
        .from('clientes_operacao')
        .update(payload)
        .eq('id', rowId)
        .eq('empresa_id', empresaId);

      if (error) throw error;

      await registrarAuditoriaAction(
        'edicao',
        [payload.protocolo || payload.cliente],
        { tabela: 'clientes_operacao', tipo: input.tipo }
      );

      return {
        success: true as const,
        id: rowId,
        message: 'Análise atualizada no Supabase.',
      };
    }

    const { data, error } = await admin
      .from('clientes_operacao')
      .insert({
        ...payload,
        created_by: ctx.auth_id || null,
      })
      .select('id')
      .single();

    if (error) throw error;

    await registrarAuditoriaAction(
      'criacao',
      [payload.protocolo || payload.cliente],
      { tabela: 'clientes_operacao', tipo: input.tipo }
    );

    return {
      success: true as const,
      id: data?.id,
      message: 'Análise salva no Supabase.',
    };
  } catch (e: any) {
    console.warn('[salvarClienteOperacao]', e?.message);
    return {
      success: false as const,
      error: e?.message || 'Falha ao salvar cliente.',
    };
  }
}

export async function excluirClienteOperacaoAction(id: string) {
  try {
    const ctx = await getUserContext();
    const empresaId = ctx?.empresa_id;

    if (!empresaId) {
      return { success: false as const, error: 'Sessão não identificada.' };
    }

    if (!isAdminGroup(ctx?.cargo)) {
      return {
        success: false as const,
        error: 'Apenas Administrador/Supervisor/Superadmin pode excluir.',
      };
    }

    const admin = await getSupabaseAdmin();
    const { error } = await admin
      .from('clientes_operacao')
      .delete()
      .eq('id', id)
      .eq('empresa_id', empresaId);

    if (error) throw error;

    await registrarAuditoriaAction('exclusao', [id], {
      tabela: 'clientes_operacao',
    });

    return { success: true as const, message: 'Registro excluído.' };
  } catch (e: any) {
    console.warn('[excluirClienteOperacao]', e?.message);
    return {
      success: false as const,
      error: e?.message || 'Falha ao excluir registro.',
    };
  }
}

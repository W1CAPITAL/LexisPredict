'use server';

/**
 * CRM Assessoria — Server Actions (multi-tenant empresa_id).
 * Operador: cria/edita negócios e recebíveis.
 * Admin/Supervisor: dashboard financeiro consolidado.
 */

import { getUserContext, getSupabaseAdmin } from '@/lib/server-db';
import { isAdminGroup } from '@/lib/roles';
import type {
  CrmServico,
  CrmFornecedor,
  CrmNegocio,
  CrmReceber,
  CrmPagar,
  CrmDashboard,
  CrmFunilStatus,
} from '@/lib/crm-types';

function uid() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return `crm_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
}

async function ctxOrFail() {
  const ctx = await getUserContext();
  if (!ctx?.empresa_id) return null;
  return ctx;
}

function tableMissing(msg: string) {
  return (
    msg.includes('crm_') ||
    msg.includes('schema cache') ||
    msg.includes('does not exist') ||
    msg.includes('relation')
  );
}

/* ===================== SERVIÇOS ===================== */

export async function listServicosAction(opts?: { ativosOnly?: boolean }) {
  const ctx = await ctxOrFail();
  if (!ctx) return { success: false as const, error: 'Sessão expirada', rows: [] as CrmServico[] };
  try {
    const admin = await getSupabaseAdmin();
    let q = admin.from('crm_servicos').select('*').eq('empresa_id', ctx.empresa_id).order('nome');
    if (opts?.ativosOnly) q = q.eq('ativo', true);
    const { data, error } = await q;
    if (error) {
      return {
        success: false as const,
        error: tableMissing(error.message)
          ? 'Tabelas CRM ausentes. Rode supabase/crm-assessoria.sql no SQL Editor.'
          : error.message,
        rows: [] as CrmServico[],
      };
    }
    return { success: true as const, rows: (data || []) as CrmServico[] };
  } catch (e: any) {
    return { success: false as const, error: e?.message || 'Falha', rows: [] as CrmServico[] };
  }
}

export async function upsertServicoAction(input: {
  id?: string;
  nome: string;
  descricao?: string;
  preco_base: number;
  prazo_dias?: number;
  ativo?: boolean;
}) {
  const ctx = await ctxOrFail();
  if (!ctx) return { success: false as const, error: 'Sessão expirada' };
  try {
    const admin = await getSupabaseAdmin();
    const row = {
      id: input.id || uid(),
      empresa_id: ctx.empresa_id,
      nome: input.nome.trim(),
      descricao: input.descricao || null,
      preco_base: Number(input.preco_base) || 0,
      prazo_dias: input.prazo_dias ?? 30,
      ativo: input.ativo !== false,
      updated_at: new Date().toISOString(),
    };
    const { error } = await admin.from('crm_servicos').upsert(row, { onConflict: 'id' });
    if (error) return { success: false as const, error: error.message };
    return { success: true as const, id: row.id };
  } catch (e: any) {
    return { success: false as const, error: e?.message || 'Falha' };
  }
}

export async function deleteServicoAction(id: string) {
  const ctx = await ctxOrFail();
  if (!ctx) return { success: false as const, error: 'Sessão expirada' };
  if (!isAdminGroup(ctx.cargo)) return { success: false as const, error: 'Apenas admin/supervisor' };
  try {
    const admin = await getSupabaseAdmin();
    const { error } = await admin
      .from('crm_servicos')
      .update({ ativo: false, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('empresa_id', ctx.empresa_id);
    if (error) return { success: false as const, error: error.message };
    return { success: true as const };
  } catch (e: any) {
    return { success: false as const, error: e?.message || 'Falha' };
  }
}

/* ===================== FORNECEDORES ===================== */

export async function listFornecedoresAction(opts?: { ativosOnly?: boolean }) {
  const ctx = await ctxOrFail();
  if (!ctx) return { success: false as const, error: 'Sessão expirada', rows: [] as CrmFornecedor[] };
  try {
    const admin = await getSupabaseAdmin();
    let q = admin.from('crm_fornecedores').select('*').eq('empresa_id', ctx.empresa_id).order('nome');
    if (opts?.ativosOnly) q = q.eq('ativo', true);
    const { data, error } = await q;
    if (error) {
      return {
        success: false as const,
        error: tableMissing(error.message)
          ? 'Tabelas CRM ausentes. Rode supabase/crm-assessoria.sql'
          : error.message,
        rows: [] as CrmFornecedor[],
      };
    }
    return { success: true as const, rows: (data || []) as CrmFornecedor[] };
  } catch (e: any) {
    return { success: false as const, error: e?.message || 'Falha', rows: [] as CrmFornecedor[] };
  }
}

export async function upsertFornecedorAction(input: {
  id?: string;
  nome: string;
  cnpj?: string;
  contato?: string;
  telefone?: string;
  email?: string;
  especialidade?: string;
  ativo?: boolean;
  observacao?: string;
}) {
  const ctx = await ctxOrFail();
  if (!ctx) return { success: false as const, error: 'Sessão expirada' };
  try {
    const admin = await getSupabaseAdmin();
    const row = {
      id: input.id || uid(),
      empresa_id: ctx.empresa_id,
      nome: input.nome.trim(),
      cnpj: input.cnpj || null,
      contato: input.contato || null,
      telefone: input.telefone || null,
      email: input.email || null,
      especialidade: input.especialidade || null,
      ativo: input.ativo !== false,
      observacao: input.observacao || null,
    };
    const { error } = await admin.from('crm_fornecedores').upsert(row, { onConflict: 'id' });
    if (error) return { success: false as const, error: error.message };
    return { success: true as const, id: row.id };
  } catch (e: any) {
    return { success: false as const, error: e?.message || 'Falha' };
  }
}

/* ===================== NEGÓCIOS / FUNIL ===================== */

export async function listNegociosAction(opts?: { status?: string; limit?: number }) {
  const ctx = await ctxOrFail();
  if (!ctx) return { success: false as const, error: 'Sessão expirada', rows: [] as CrmNegocio[] };
  try {
    const admin = await getSupabaseAdmin();
    let q = admin
      .from('crm_negocios')
      .select('*')
      .eq('empresa_id', ctx.empresa_id)
      .order('updated_at', { ascending: false })
      .limit(opts?.limit ?? 300);
    if (opts?.status && opts.status !== 'todos') q = q.eq('status', opts.status);
    const { data, error } = await q;
    if (error) {
      return {
        success: false as const,
        error: tableMissing(error.message)
          ? 'Tabelas CRM ausentes. Rode supabase/crm-assessoria.sql'
          : error.message,
        rows: [] as CrmNegocio[],
      };
    }
    return { success: true as const, rows: (data || []) as CrmNegocio[] };
  } catch (e: any) {
    return { success: false as const, error: e?.message || 'Falha', rows: [] as CrmNegocio[] };
  }
}

export async function upsertNegocioAction(input: {
  id?: string;
  cliente_nome: string;
  cliente_doc?: string;
  cliente_telefone?: string;
  cliente_email?: string;
  servico_id?: string;
  servico_nome?: string;
  status: string;
  valor_total: number;
  valor_entrada?: number;
  protocolo_cnj?: string;
  fornecedor_id?: string;
  custo_terceiro?: number;
  origem?: string;
  responsavel?: string;
  observacao?: string;
  data_fechamento?: string;
  /** Se true e valor_total > 0, gera parcela única a receber */
  gerar_parcela?: boolean;
  /** Número de parcelas (default 1) */
  num_parcelas?: number;
}) {
  const ctx = await ctxOrFail();
  if (!ctx) return { success: false as const, error: 'Sessão expirada' };
  try {
    const admin = await getSupabaseAdmin();
    const id = input.id || uid();
    const row = {
      id,
      empresa_id: ctx.empresa_id,
      created_by: ctx.auth_id || null,
      cliente_nome: input.cliente_nome.trim(),
      cliente_doc: input.cliente_doc || null,
      cliente_telefone: input.cliente_telefone || null,
      cliente_email: input.cliente_email || null,
      servico_id: input.servico_id || null,
      servico_nome: input.servico_nome || null,
      status: (input.status || 'lead') as CrmFunilStatus,
      valor_total: Number(input.valor_total) || 0,
      valor_entrada: Number(input.valor_entrada) || 0,
      protocolo_cnj: input.protocolo_cnj || null,
      fornecedor_id: input.fornecedor_id || null,
      custo_terceiro: Number(input.custo_terceiro) || 0,
      origem: input.origem || null,
      responsavel: input.responsavel || null,
      observacao: input.observacao || null,
      data_fechamento: input.data_fechamento || null,
      updated_at: new Date().toISOString(),
    };
    const { error } = await admin.from('crm_negocios').upsert(row, { onConflict: 'id' });
    if (error) return { success: false as const, error: error.message };

    // Parcelas a receber ao fechar contrato/execução
    if (input.gerar_parcela && row.valor_total > 0 && !input.id) {
      const n = Math.max(1, Math.min(24, input.num_parcelas || 1));
      const restante = Math.max(0, row.valor_total - (row.valor_entrada || 0));
      const base = n > 0 ? restante / n : restante;
      const hoje = new Date();
      for (let i = 0; i < n; i++) {
        const venc = new Date(hoje);
        venc.setMonth(venc.getMonth() + i + (row.valor_entrada > 0 && i === 0 ? 0 : 1));
        await admin.from('crm_receber').insert({
          id: uid(),
          empresa_id: ctx.empresa_id,
          negocio_id: id,
          cliente_nome: row.cliente_nome,
          descricao: n === 1 ? `Serviço — ${row.servico_nome || row.cliente_nome}` : `Parcela ${i + 1}/${n}`,
          valor: Math.round(base * 100) / 100,
          vencimento: venc.toISOString().slice(0, 10),
          status: 'pendente',
        });
      }
      if (row.valor_entrada > 0) {
        await admin.from('crm_receber').insert({
          id: uid(),
          empresa_id: ctx.empresa_id,
          negocio_id: id,
          cliente_nome: row.cliente_nome,
          descricao: 'Entrada',
          valor: row.valor_entrada,
          vencimento: hoje.toISOString().slice(0, 10),
          status: 'pendente',
        });
      }
    }

    // Custo de banca terceira → conta a pagar
    if (row.custo_terceiro > 0 && row.fornecedor_id && !input.id) {
      await admin.from('crm_pagar').insert({
        id: uid(),
        empresa_id: ctx.empresa_id,
        negocio_id: id,
        fornecedor_id: row.fornecedor_id,
        descricao: `Custo jurídico — ${row.cliente_nome}`,
        valor: row.custo_terceiro,
        status: 'pendente',
        categoria: 'banca_terceira',
        vencimento: new Date().toISOString().slice(0, 10),
      });
    }

    return { success: true as const, id };
  } catch (e: any) {
    return { success: false as const, error: e?.message || 'Falha' };
  }
}

export async function updateNegocioStatusAction(id: string, status: string) {
  const ctx = await ctxOrFail();
  if (!ctx) return { success: false as const, error: 'Sessão expirada' };
  try {
    const admin = await getSupabaseAdmin();
    const patch: Record<string, unknown> = {
      status,
      updated_at: new Date().toISOString(),
    };
    if (status === 'concluido' || status === 'contrato') {
      patch.data_fechamento = new Date().toISOString().slice(0, 10);
    }
    const { error } = await admin
      .from('crm_negocios')
      .update(patch)
      .eq('id', id)
      .eq('empresa_id', ctx.empresa_id);
    if (error) return { success: false as const, error: error.message };
    return { success: true as const };
  } catch (e: any) {
    return { success: false as const, error: e?.message || 'Falha' };
  }
}

/* ===================== RECEBER / PAGAR ===================== */

export async function listReceberAction(opts?: { status?: string }) {
  const ctx = await ctxOrFail();
  if (!ctx) return { success: false as const, error: 'Sessão expirada', rows: [] as CrmReceber[] };
  try {
    const admin = await getSupabaseAdmin();
    let q = admin
      .from('crm_receber')
      .select('*')
      .eq('empresa_id', ctx.empresa_id)
      .order('vencimento', { ascending: true })
      .limit(400);
    if (opts?.status && opts.status !== 'todos') q = q.eq('status', opts.status);
    const { data, error } = await q;
    if (error) {
      return {
        success: false as const,
        error: tableMissing(error.message) ? 'Tabelas CRM ausentes' : error.message,
        rows: [] as CrmReceber[],
      };
    }
    return { success: true as const, rows: (data || []) as CrmReceber[] };
  } catch (e: any) {
    return { success: false as const, error: e?.message || 'Falha', rows: [] as CrmReceber[] };
  }
}

export async function marcarReceberPagoAction(id: string, forma?: string) {
  const ctx = await ctxOrFail();
  if (!ctx) return { success: false as const, error: 'Sessão expirada' };
  try {
    const admin = await getSupabaseAdmin();
    const { error } = await admin
      .from('crm_receber')
      .update({
        status: 'pago',
        pago_em: new Date().toISOString().slice(0, 10),
        forma_pagamento: forma || 'pix',
      })
      .eq('id', id)
      .eq('empresa_id', ctx.empresa_id);
    if (error) return { success: false as const, error: error.message };
    return { success: true as const };
  } catch (e: any) {
    return { success: false as const, error: e?.message || 'Falha' };
  }
}

export async function upsertReceberAction(input: {
  id?: string;
  negocio_id?: string;
  cliente_nome?: string;
  descricao?: string;
  valor: number;
  vencimento?: string;
  status?: string;
}) {
  const ctx = await ctxOrFail();
  if (!ctx) return { success: false as const, error: 'Sessão expirada' };
  try {
    const admin = await getSupabaseAdmin();
    const row = {
      id: input.id || uid(),
      empresa_id: ctx.empresa_id,
      negocio_id: input.negocio_id || null,
      cliente_nome: input.cliente_nome || null,
      descricao: input.descricao || null,
      valor: Number(input.valor) || 0,
      vencimento: input.vencimento || null,
      status: input.status || 'pendente',
    };
    const { error } = await admin.from('crm_receber').upsert(row, { onConflict: 'id' });
    if (error) return { success: false as const, error: error.message };
    return { success: true as const, id: row.id };
  } catch (e: any) {
    return { success: false as const, error: e?.message || 'Falha' };
  }
}

export async function listPagarAction(opts?: { status?: string }) {
  const ctx = await ctxOrFail();
  if (!ctx) return { success: false as const, error: 'Sessão expirada', rows: [] as CrmPagar[] };
  try {
    const admin = await getSupabaseAdmin();
    let q = admin
      .from('crm_pagar')
      .select('*')
      .eq('empresa_id', ctx.empresa_id)
      .order('vencimento', { ascending: true })
      .limit(400);
    if (opts?.status && opts.status !== 'todos') q = q.eq('status', opts.status);
    const { data, error } = await q;
    if (error) {
      return {
        success: false as const,
        error: tableMissing(error.message) ? 'Tabelas CRM ausentes' : error.message,
        rows: [] as CrmPagar[],
      };
    }
    return { success: true as const, rows: (data || []) as CrmPagar[] };
  } catch (e: any) {
    return { success: false as const, error: e?.message || 'Falha', rows: [] as CrmPagar[] };
  }
}

export async function upsertPagarAction(input: {
  id?: string;
  negocio_id?: string;
  fornecedor_id?: string;
  fornecedor_nome?: string;
  descricao: string;
  valor: number;
  vencimento?: string;
  status?: string;
  categoria?: string;
}) {
  const ctx = await ctxOrFail();
  if (!ctx) return { success: false as const, error: 'Sessão expirada' };
  try {
    const admin = await getSupabaseAdmin();
    const row = {
      id: input.id || uid(),
      empresa_id: ctx.empresa_id,
      negocio_id: input.negocio_id || null,
      fornecedor_id: input.fornecedor_id || null,
      fornecedor_nome: input.fornecedor_nome || null,
      descricao: input.descricao,
      valor: Number(input.valor) || 0,
      vencimento: input.vencimento || null,
      status: input.status || 'pendente',
      categoria: input.categoria || 'banca_terceira',
    };
    const { error } = await admin.from('crm_pagar').upsert(row, { onConflict: 'id' });
    if (error) return { success: false as const, error: error.message };
    return { success: true as const, id: row.id };
  } catch (e: any) {
    return { success: false as const, error: e?.message || 'Falha' };
  }
}

export async function marcarPagarPagoAction(id: string) {
  const ctx = await ctxOrFail();
  if (!ctx) return { success: false as const, error: 'Sessão expirada' };
  try {
    const admin = await getSupabaseAdmin();
    const { error } = await admin
      .from('crm_pagar')
      .update({ status: 'pago', pago_em: new Date().toISOString().slice(0, 10) })
      .eq('id', id)
      .eq('empresa_id', ctx.empresa_id);
    if (error) return { success: false as const, error: error.message };
    return { success: true as const };
  } catch (e: any) {
    return { success: false as const, error: e?.message || 'Falha' };
  }
}

/* ===================== DASHBOARD ===================== */

export async function crmDashboardAction(): Promise<{
  success: boolean;
  error?: string;
  data: CrmDashboard;
  canViewFinance: boolean;
}> {
  const empty: CrmDashboard = {
    receitaMes: 0,
    aReceber: 0,
    atrasados: 0,
    custoTerceirosMes: 0,
    ticketMedio: 0,
    conversaoPct: 0,
    totalNegocios: 0,
    leads: 0,
    emExecucao: 0,
    concluidos: 0,
  };
  const ctx = await ctxOrFail();
  if (!ctx) return { success: false, error: 'Sessão expirada', data: empty, canViewFinance: false };

  const canViewFinance = isAdminGroup(ctx.cargo);

  try {
    const admin = await getSupabaseAdmin();
    const mes = new Date().toISOString().slice(0, 7); // YYYY-MM
    const hoje = new Date().toISOString().slice(0, 10);

    const [neg, rec, pag] = await Promise.all([
      admin.from('crm_negocios').select('id,status,valor_total').eq('empresa_id', ctx.empresa_id),
      admin.from('crm_receber').select('valor,status,pago_em,vencimento').eq('empresa_id', ctx.empresa_id),
      admin.from('crm_pagar').select('valor,status,pago_em,categoria').eq('empresa_id', ctx.empresa_id),
    ]);

    if (neg.error && tableMissing(neg.error.message)) {
      return {
        success: false,
        error: 'Tabelas CRM ausentes. Rode supabase/crm-assessoria.sql',
        data: empty,
        canViewFinance,
      };
    }

    const negocios = neg.data || [];
    const receber = rec.data || [];
    const pagar = pag.data || [];

    const receitaMes = canViewFinance
      ? receber
          .filter((r) => r.status === 'pago' && r.pago_em && String(r.pago_em).startsWith(mes))
          .reduce((s, r) => s + Number(r.valor || 0), 0)
      : 0;

    const aReceber = canViewFinance
      ? receber.filter((r) => r.status === 'pendente' || r.status === 'atrasado').reduce((s, r) => s + Number(r.valor || 0), 0)
      : 0;

    const atrasados = canViewFinance
      ? receber
          .filter((r) => (r.status === 'pendente' || r.status === 'atrasado') && r.vencimento && r.vencimento < hoje)
          .reduce((s, r) => s + Number(r.valor || 0), 0)
      : 0;

    const custoTerceirosMes = canViewFinance
      ? pagar
          .filter(
            (p) =>
              p.status === 'pago' &&
              p.pago_em &&
              String(p.pago_em).startsWith(mes) &&
              (p.categoria === 'banca_terceira' || !p.categoria)
          )
          .reduce((s, p) => s + Number(p.valor || 0), 0)
      : 0;

    const fechados = negocios.filter((n) =>
      ['contrato', 'execucao', 'concluido'].includes(String(n.status))
    );
    const ticketMedio =
      fechados.length > 0
        ? fechados.reduce((s, n) => s + Number(n.valor_total || 0), 0) / fechados.length
        : 0;

    const total = negocios.length;
    const leads = negocios.filter((n) => n.status === 'lead').length;
    const conversaoPct =
      total > 0 ? Math.round((fechados.length / total) * 1000) / 10 : 0;

    return {
      success: true,
      canViewFinance,
      data: {
        receitaMes,
        aReceber,
        atrasados,
        custoTerceirosMes,
        ticketMedio,
        conversaoPct,
        totalNegocios: total,
        leads,
        emExecucao: negocios.filter((n) => n.status === 'execucao').length,
        concluidos: negocios.filter((n) => n.status === 'concluido').length,
      },
    };
  } catch (e: any) {
    return { success: false, error: e?.message || 'Falha', data: empty, canViewFinance };
  }
}

/** Serviços padrão para seed rápido */
export async function seedServicosPadraoAction() {
  const ctx = await ctxOrFail();
  if (!ctx) return { success: false as const, error: 'Sessão expirada' };
  if (!isAdminGroup(ctx.cargo)) return { success: false as const, error: 'Apenas admin' };
  const padrao = [
    { nome: 'Extrajudicial', preco_base: 800, prazo_dias: 45 },
    { nome: 'Intermediação de quitação', preco_base: 1500, prazo_dias: 60 },
    { nome: 'Limpa nome', preco_base: 600, prazo_dias: 30 },
    { nome: 'Resposta PROCON', preco_base: 450, prazo_dias: 15 },
    { nome: 'Apoio em audiência', preco_base: 350, prazo_dias: 10 },
    { nome: 'Pacote regularização', preco_base: 2000, prazo_dias: 90 },
  ];
  for (const s of padrao) {
    await upsertServicoAction(s);
  }
  return { success: true as const, count: padrao.length };
}

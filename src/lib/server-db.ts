
'use server';

import { supabase, isSupabaseConfigured, UserProfile, UserRole, checkIfSuperAdmin, checkIfSupervisor } from './supabase';
import { LegalCase, formatDateToISO, processarCaso } from './case-logic';
import { cookies } from 'next/headers';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';

/**
 * REPOSITÓRIO CENTRAL LEXISPREDICT (v290.0 ELITE)
 * Governança de Visibilidade: Visão Master restrita a Superadmin e Supervisor.
 * Suporte a Workers de Sistema via Service Role para Auditoria em Background.
 */

const ROLE_WEIGHTS: Record<UserRole, number> = {
  'Superadmin': 100,
  'Supervisor': 80,
  'Administrador': 60,
  'Operador': 40,
  'Visualizador': 20
};

export async function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Configuração de Admin (Service Role) ausente nas ENV.");
  return createSupabaseClient(url, key);
}

export async function getUserContext() {
  const cookieStore = await cookies();
  const userEmail = cookieStore.get('lexis_user_email')?.value;
  
  if (!userEmail) return { auth_id: null, empresa_id: null, cargo: null as UserRole | null, email: null, isSuperAdmin: false, isSupervisor: false, isMasterView: false, weight: 0 };
  if (!supabase) return { auth_id: null, empresa_id: null, cargo: null as UserRole | null, email: null, isSuperAdmin: false, isSupervisor: false, isMasterView: false, weight: 0 };

  const { data: profile } = await supabase
    .from('usuarios')
    .select('id, empresa_id, cargo, email, auth_user_id')
    .eq('email', userEmail.toLowerCase().trim())
    .maybeSingle();
    
  const cargo = (profile?.cargo as UserRole) || 'Operador';
  const isSuperAdmin = checkIfSuperAdmin(profile);
  const isSupervisor = checkIfSupervisor(profile);
  const isMasterView = isSuperAdmin || isSupervisor; 

  return { 
    auth_id: profile?.auth_user_id || null,
    empresa_id: profile?.empresa_id || null, 
    cargo: cargo,
    email: profile?.email || null,
    isSuperAdmin,
    isSupervisor,
    isMasterView,
    weight: ROLE_WEIGHTS[cargo] || 0
  };
}

export async function getStoredCases(): Promise<LegalCase[]> {
  const { empresa_id } = await getUserContext();
  if (!empresa_id) return [];
  return getStoredCasesForEmpresa(empresa_id);
}

export async function getStoredCasesForEmpresa(empresaId: string, isAdmin = false): Promise<LegalCase[]> {
  if (!isSupabaseConfigured) return [];
  const client = isAdmin ? await getSupabaseAdmin() : supabase;
  if (!client) return [];

  try {
    let allData: any[] = [];
    let page = 0;
    const pageSize = 1000;
    let hasMore = true;

    while (hasMore) {
      let query = client
        .from('processos')
        .select('*')
        .eq('empresa_id', empresaId)
        .order('created_at', { ascending: false })
        .range(page * pageSize, (page + 1) * pageSize - 1);

      if (!isAdmin) {
        const { auth_id, isMasterView } = await getUserContext();
        if (!isMasterView && auth_id) {
          query = query.eq('created_by', auth_id);
        }
      }

      const { data, error } = await query;
      if (error) throw error;

      if (data && data.length > 0) {
        allData = [...allData, ...data];
        hasMore = data.length === pageSize;
        page++;
      } else {
        hasMore = false;
      }
    }
    
    return allData.map(item => processarCaso({
      ...(item.dados as any),
      id: item.id.toString(),
      db_id: item.id.toString(),
      created_by: item.created_by,
      datajud_ultimo_movimento: item.datajud_ultimo_movimento,
      datajud_ultimo_nome: item.datajud_ultimo_nome,
      datajud_consultado_em: item.datajud_consultado_em,
      tem_atualizacao_pos_retorno: item.tem_atualizacao_pos_retorno,
      datajud_encerrado_tribunal: item.datajud_encerrado_tribunal,
      datajud_encerrado_motivo: item.datajud_encerrado_motivo,
      datajud_hash: item.datajud_hash,
      indicio_busca_apreensao: item.indicio_busca_apreensao,
      busca_apreensao_confianca: item.busca_apreensao_confianca,
      busca_apreensao_motivo: item.busca_apreensao_motivo,
      busca_apreensao_consultado_em: item.busca_apreensao_consultado_em
    }));
  } catch (error) {
    return [];
  }
}

export async function getGlobalPendingProcessesSystem(limit: number, empresaId?: string): Promise<LegalCase[]> {
  const admin = await getSupabaseAdmin();
  const statusExcluidos = ['ENCERRADO', 'Arquivado', 'EXTINTO', 'SUSPENSO', 'IMOVEL', 'IMÓVEL', 'finalizado'];

  let query = admin
    .from('processos')
    .select('*')
    .not('status', 'in', `(${statusExcluidos.map(s => `"${s}"`).join(',')})`);

  if (empresaId) {
    query = query.eq('empresa_id', empresaId);
  }

  const { data, error } = await query
    .order('datajud_consultado_em', { ascending: true, nullsFirst: true })
    .limit(limit);

  if (error || !data) return [];

  return data.map(item => processarCaso({
    ...(item.dados as any),
    id: item.id.toString(),
    db_id: item.id.toString(),
    empresa_id: item.empresa_id,
    created_by: item.created_by,
    datajud_ultimo_movimento: item.datajud_ultimo_movimento,
    datajud_ultimo_nome: item.datajud_ultimo_nome,
    datajud_consultado_em: item.datajud_consultado_em,
    tem_atualizacao_pos_retorno: item.tem_atualizacao_pos_retorno,
    datajud_encerrado_tribunal: item.datajud_encerrado_tribunal,
    datajud_encerrado_motivo: item.datajud_encerrado_motivo,
    datajud_hash: item.datajud_hash,
    indicio_busca_apreensao: item.indicio_busca_apreensao,
    busca_apreensao_confianca: item.busca_apreensao_confianca,
    busca_apreensao_motivo: item.busca_apreensao_motivo,
    busca_apreensao_consultado_em: item.busca_apreensao_consultado_em
  }));
}

export async function getScanStatusMetrics(empresaId: string) {
  const admin = await getSupabaseAdmin();
  const statusExcluidos = ['ENCERRADO', 'Arquivado', 'EXTINTO', 'SUSPENSO', 'IMOVEL', 'IMÓVEL', 'finalizado'];

  const { count: total } = await admin
    .from('processos')
    .select('*', { count: 'exact', head: true })
    .eq('empresa_id', empresaId);

  const { count: pending } = await admin
    .from('processos')
    .select('*', { count: 'exact', head: true })
    .eq('empresa_id', empresaId)
    .not('status', 'in', `(${statusExcluidos.map(s => `"${s}"`).join(',')})`);

  const { count: alerts } = await admin
    .from('processos')
    .select('*', { count: 'exact', head: true })
    .eq('empresa_id', empresaId)
    .eq('tem_atualizacao_pos_retorno', true);

  const { count: closed } = await admin
    .from('processos')
    .select('*', { count: 'exact', head: true })
    .eq('empresa_id', empresaId)
    .eq('datajud_encerrado_tribunal', true);

  // Recupera as últimas 5 atividades da nuvem para o log da UI
  const { data: recent } = await admin
    .from('processos')
    .select('protocolo_ref, tem_atualizacao_pos_retorno, datajud_encerrado_tribunal, datajud_ultimo_nome')
    .eq('empresa_id', empresaId)
    .order('datajud_consultado_em', { ascending: false })
    .limit(5);

  return {
    total: total || 0,
    pending: pending || 0,
    alerts: alerts || 0,
    closed: closed || 0,
    audited: (total || 0) - (pending || 0),
    recentLogs: recent?.map(r => ({
      protocolo: r.protocolo_ref,
      message: r.datajud_encerrado_tribunal ? 'BAIXA NO TRIBUNAL' : r.tem_atualizacao_pos_retorno ? 'NOVA MOVIMENTAÇÃO' : 'Monitoramento Regular',
      success: true,
      type: r.datajud_encerrado_tribunal ? 'closed' : r.tem_atualizacao_pos_retorno ? 'update' : 'ok',
      engine: 'Nuvem'
    })) || []
  };
}

export async function updateCaseDataJudSystem(caseId: string, patch: any) {
  const admin = await getSupabaseAdmin();
  
  const { data: current, error: fetchError } = await admin
    .from('processos')
    .select('dados')
    .eq('id', caseId)
    .single();
    
  if (fetchError || !current) return { success: false };

  const updatedDados = {
    ...current.dados,
    ...patch
  };

  const { error } = await admin
    .from('processos')
    .update({
      ...patch, 
      dados: updatedDados
    })
    .eq('id', caseId);
    
  return { success: !error };
}

export async function saveStoredCasesForEmpresa(cases: LegalCase[], empresaId: string, isAdmin = false): Promise<{ success: boolean; message: string }> {
  const client = isAdmin ? await getSupabaseAdmin() : supabase;
  if (!client) return { success: false, message: "Erro de Configuração." };

  try {
    const { auth_id } = await getUserContext();
    const uniqueMap = new Map();
    cases.forEach(c => { if (c && c.protocolo) uniqueMap.set(c.protocolo, c); });
    
    const payload = Array.from(uniqueMap.values()).map(c => {
      const isoPrazo = formatDateToISO(c.proximoPrazo);
      const isoRetorno = formatDateToISO(c.ultimoRetorno);
      
      return { 
        empresa_id: empresaId, 
        created_by: c.created_by || auth_id,
        protocolo_ref: c.protocolo,
        advogado: c.advogado || 'NÃO ATRIBUÍDO',
        escritorio: c.escritorio || null,
        status: c.status || 'Sem Prazo',
        risco: c.risco || 'Normal',
        proximo_retorno: isoPrazo, 
        ultimo_retorno: isoRetorno,
        tribunal: c.tribunal || 'Outros',
        telefone: c.telefone || '',
        observacoes: c.observacao || '',
        datajud_ultimo_movimento: c.datajud_ultimo_movimento,
        datajud_ultimo_nome: c.datajud_ultimo_nome,
        datajud_consultado_em: c.datajud_consultado_em,
        tem_atualizacao_pos_retorno: c.tem_atualizacao_pos_retorno,
        datajud_encerrado_tribunal: c.datajud_encerrado_tribunal,
        datajud_encerrado_motivo: c.datajud_encerrado_motivo,
        datajud_hash: c.datajud_hash || null,
        indicio_busca_apreensao: c.indicio_busca_apreensao,
        busca_apreensao_confianca: c.busca_apreensao_confianca,
        busca_apreensao_motivo: c.busca_apreensao_motivo,
        busca_apreensao_consultado_em: c.busca_apreensao_consultado_em,
        dados: { ...c }
      };
    });

    const chunkSize = 50;
    for (let i = 0; i < payload.length; i += chunkSize) {
      const chunk = payload.slice(i, i + chunkSize);
      const { error: upsertError } = await client
        .from('processos')
        .upsert(chunk, { onConflict: 'protocolo_ref, empresa_id' });
      if (upsertError) throw upsertError;
    }

    return { success: true, message: "Sincronia concluída." };
  } catch (error: any) {
    return { success: false, message: error.message || "Erro desconhecido no repositório." };
  }
}

export async function listAllEmpresasSystem() {
  const admin = await getSupabaseAdmin();
  const { data } = await admin.from('empresas').select('id, nome');
  return data || [];
}

export async function getStoredNotes(): Promise<any[]> {
  const { auth_id, empresa_id, isMasterView } = await getUserContext();
  if (!empresa_id || !auth_id || !supabase) return [];
  const hasFullAccess = isMasterView === true;

  try {
    let allData: any[] = [];
    let page = 0;
    const pageSize = 1000;
    let hasMore = true;
    while (hasMore) {
      let query = supabase.from('notes').select('*').eq('empresa_id', empresa_id).order('created_at', { ascending: false }).range(page * pageSize, (page + 1) * pageSize - 1);
      if (!hasFullAccess) { query = query.eq('created_by', auth_id); }
      const { data, error } = await query;
      if (error) throw error;
      if (data && data.length > 0) {
        allData = [...allData, ...data];
        hasMore = data.length === pageSize;
        page++;
      } else { hasMore = false; }
    }
    return allData.map(item => {
      let imageUrl;
      let displayContent = item.content || '';
      try { if (displayContent.startsWith('{')) { const parsed = JSON.parse(displayContent); displayContent = parsed.text; imageUrl = parsed.imageUrl; } } catch (e) {}
      return { id: item.id.toString(), title: item.title || 'Nota', content: displayContent, imageUrl: imageUrl, color: 'bg-white', updatedAt: new Date(item.created_at).toLocaleString('pt-BR') };
    });
  } catch (error) { return []; }
}

export async function saveSingleNote(note: any): Promise<{ success: boolean; data?: any }> {
  const { auth_id, empresa_id } = await getUserContext();
  if (!empresa_id || !auth_id || !supabase) return { success: false };
  const dbNote = { title: note.title || 'Nota', content: note.imageUrl ? JSON.stringify({ text: note.content, imageUrl: note.imageUrl }) : note.content, empresa_id: empresa_id, created_by: auth_id };
  const { data, error } = await supabase.from('notes').insert(dbNote).select().single();
  if (error) return { success: false };
  return { success: true, data };
}

export async function updateStoredNote(id: string, updates: any): Promise<{ success: boolean }> {
  const { empresa_id } = await getUserContext();
  if (!empresa_id || !supabase) return { success: false };
  const dbUpdates: any = {};
  if (updates.title !== undefined) dbUpdates.title = updates.title;
  if (updates.content !== undefined || updates.imageUrl !== undefined) { dbUpdates.content = updates.imageUrl ? JSON.stringify({ text: updates.content, imageUrl: updates.imageUrl }) : updates.content; }
  const { error } = await supabase.from('notes').update(dbUpdates).eq('id', id).eq('empresa_id', empresa_id);
  return { success: !error };
}

export async function deleteStoredNote(id: string): Promise<{ success: boolean }> {
  const { empresa_id } = await getUserContext();
  if (!empresa_id || !supabase) return { success: false };
  const { error = null } = await supabase.from('notes').delete().eq('id', id).eq('empresa_id', empresa_id);
  return { success: !error };
}

export async function getEmpresaUsers(): Promise<UserProfile[]> {
  const { empresa_id } = await getUserContext();
  if (!empresa_id || !supabase) return [];
  const { data, error } = await supabase.from('usuarios').select('*').eq('empresa_id', empresa_id).order('nome', { ascending: true });
  return (data as UserProfile[]) || [];
}

export async function createEmpresaUserAction(userData: any) {
  const { isSuperAdmin, empresa_id } = await getUserContext();
  if (!isSuperAdmin || !empresa_id) return { success: false, error: 'Permissão insuficiente.' };
  const adminClient = await getSupabaseAdmin();
  try {
    const { data: authUser, error: authError } = await adminClient.auth.admin.createUser({ email: userData.email, password: userData.password, email_confirm: true, user_metadata: { full_name: userData.nome } });
    if (authError) throw authError;
    const { error: profileError } = await adminClient.from('usuarios').insert({ auth_user_id: authUser.user.id, empresa_id: empresa_id, nome: userData.nome.toUpperCase(), email: userData.email.toLowerCase(), cargo: userData.cargo || 'Operador' });
    if (profileError) throw profileError;
    return { success: true };
  } catch (e: any) { return { success: false, error: e.message }; }
}

export async function removeEmpresaUser(id: string) {
  const { empresa_id, isMasterView } = await getUserContext();
  if (!isMasterView) return { success: false, error: 'Permissão insuficiente.' };
  const { error } = await supabase.from('usuarios').delete().eq('id', id).eq('empresa_id', empresa_id);
  return { success: !error, error: error?.message };
}

export async function updateUserRole(userId: string, newRole: UserRole) {
  const { empresa_id, isSuperAdmin, weight } = await getUserContext();
  const targetWeight = ROLE_WEIGHTS[newRole] || 0;
  if (!isSuperAdmin && weight <= targetWeight) return { success: false, error: 'Autoridade insuficiente.' };
  const { error } = await supabase.from('usuarios').update({ cargo: newRole }).eq('id', userId).eq('empresa_id', empresa_id);
  return { success: !error, error: error?.message };
}

export async function getWhatsAppHistory(phone: string) {
  const { empresa_id } = await getUserContext();
  if (!empresa_id || !supabase) return [];
  const cleanPhone = phone.replace(/\D/g, '');
  const searchPhone = (cleanPhone.length === 10 || cleanPhone.length === 11) ? `55${cleanPhone}` : cleanPhone;
  const { data, error } = await supabase.from('whatsapp_messages').select('*').eq('contact_number', searchPhone).order('timestamp', { ascending: true });
  if (error) return [];
  return data;
}

export async function listAdvogadosBanca() {
  const { empresa_id } = await getUserContext();
  if (!empresa_id || !supabase) return [];
  const { data, error } = await supabase.from('advogados_banca').select('*').eq('empresa_id', empresa_id).eq('ativo', true).order('nome', { ascending: true });
  return data || [];
}

export async function upsertAdvogadoBanca(adv: any) {
  const { empresa_id } = await getUserContext();
  if (!empresa_id || !supabase) return { success: false, error: 'Sessão expirada' };
  const payload = { ...adv, empresa_id: empresa_id, ativo: adv.ativo ?? true };
  const { data, error } = await supabase.from('advogados_banca').upsert(payload, { onConflict: 'id' }).select().single();
  if (error) return { success: false, error: error.message };
  return { success: true, data };
}

export async function desativarAdvogadoBanca(id: string) {
  const { empresa_id } = await getUserContext();
  if (!empresa_id || !supabase) return { success: false };
  const { error = null } = await supabase.from('advogados_banca').update({ ativo: false }).eq('id', id).eq('empresa_id', empresa_id);
  return { success: !error };
}

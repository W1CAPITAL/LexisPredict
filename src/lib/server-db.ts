'use server';

import { supabase, isSupabaseConfigured, UserProfile, UserRole, checkIfSuperAdmin, checkIfSupervisor } from './supabase';
import { LegalCase, CaseNote, formatDateToISO, processarCaso } from './case-logic';
import { cookies } from 'next/headers';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { detectarAtualizacaoPosRetorno } from './datajud-sync';

/**
 * REPOSITÓRIO CENTRAL LEXISPREDICT (v5200.0 ELITE)
 * Governança de Supervisor e Sincronia Ilimitada com Varredura DataJud.
 */

const ROLE_WEIGHTS: Record<UserRole, number> = {
  'Superadmin': 100,
  'Supervisor': 80,
  'Administrador': 60,
  'Operador': 40,
  'Visualizador': 20
};

export async function getUserContext() {
  const cookieStore = await cookies();
  const userEmail = cookieStore.get('lexis_user_email')?.value;
  
  if (!userEmail) return { auth_id: null, empresa_id: null, cargo: null as UserRole | null, email: null, isSuperAdmin: false, isSupervisor: false, weight: 0 };

  if (!supabase) return { auth_id: null, empresa_id: null, cargo: null as UserRole | null, email: null, isSuperAdmin: false, isSupervisor: false, weight: 0 };

  const { data: profile } = await supabase
    .from('usuarios')
    .select('id, empresa_id, cargo, email, auth_user_id')
    .eq('email', userEmail.toLowerCase().trim())
    .maybeSingle();
    
  const cargo = (profile?.cargo as UserRole) || 'Operador';
  const isSuperAdmin = checkIfSuperAdmin(profile);
  const isSupervisor = checkIfSupervisor(profile);

  return { 
    auth_id: profile?.auth_user_id || null,
    empresa_id: profile?.empresa_id || null, 
    cargo: cargo,
    email: profile?.email || null,
    isSuperAdmin,
    isSupervisor,
    weight: ROLE_WEIGHTS[cargo] || 0
  };
}

export async function logAuditAction(action: string, detail: string) {
  const { auth_id, email, empresa_id } = await getUserContext();
  if (!auth_id || !supabase) return;

  try {
    await supabase.from('audit_logs').insert({
      user_id: auth_id,
      user_email: email,
      empresa_id: empresa_id,
      action: action,
      detail: detail,
      timestamp: new Date().toISOString()
    });
  } catch (e) {
    console.warn('[Audit] Falha ao registrar log.');
  }
}

// --- GESTÃO DE PROCESSOS ---

export async function getStoredCases(): Promise<LegalCase[]> {
  if (!isSupabaseConfigured || !supabase) return [];
  const { empresa_id, auth_id, isSupervisor } = await getUserContext();
  if (!empresa_id || !auth_id) return [];

  try {
    let allData: any[] = [];
    let page = 0;
    const pageSize = 1000;
    let hasMore = true;

    while (hasMore) {
      let query = supabase
        .from('processos')
        .select('*')
        .eq('empresa_id', empresa_id)
        .order('created_at', { ascending: false })
        .range(page * pageSize, (page + 1) * pageSize - 1);

      // Regra de Ouro: Supervisor enxerga tudo da empresa. Operador enxerga apenas o que criou.
      if (!isSupervisor && !checkIfSuperAdmin({ cargo: (await getUserContext()).cargo })) {
        query = query.eq('created_by', auth_id);
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
    
    return allData.map(item => {
      return processarCaso({
        ...(item.dados as any),
        id: item.id.toString(),
        db_id: item.id.toString(),
        created_by: item.created_by,
        escritorio: item.escritorio || (item.dados as any).escritorio || '',
        proximoPrazo: item.proximo_retorno || (item.dados as any).proximoPrazo || '',
        ultimoRetorno: item.ultimo_retorno || (item.dados as any).ultimoRetorno || '',
        datajud_ultimo_movimento: item.datajud_ultimo_movimento,
        datajud_ultimo_nome: item.datajud_ultimo_nome,
        datajud_consultado_em: item.datajud_consultado_em,
        tem_atualizacao_pos_retorno: item.tem_atualizacao_pos_retorno
      });
    });
  } catch (error) {
    console.error('[DB] Fetch Fail:', error);
    return [];
  }
}

export async function saveStoredCases(cases: LegalCase[]): Promise<{ success: boolean; message: string }> {
  if (!isSupabaseConfigured || !supabase) return { success: false, message: "Erro de Configuração." };
  const { auth_id, empresa_id } = await getUserContext();
  if (!empresa_id || !auth_id) return { success: false, message: "Sessão expirada." };

  try {
    const uniqueMap = new Map();
    cases.forEach(c => { if (c && c.protocolo) uniqueMap.set(c.protocolo, c); });
    
    const payload = Array.from(uniqueMap.values()).map(c => {
      const isoPrazo = formatDateToISO(c.proximoPrazo);
      const isoRetorno = formatDateToISO(c.ultimoRetorno);
      
      // Auto-limpeza do alerta: se o usuário deu um retorno novo hoje, 
      // a data de retorno provavelmente empata ou vence o último movimento do DataJud.
      let finalTemAtualizacao = c.tem_atualizacao_pos_retorno ?? false;
      if (finalTemAtualizacao && c.datajud_ultimo_movimento && isoRetorno) {
        if (new Date(isoRetorno).getTime() >= new Date(c.datajud_ultimo_movimento).getTime()) {
          finalTemAtualizacao = false;
        }
      }

      return { 
        empresa_id: empresa_id, 
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
        tem_atualizacao_pos_retorno: finalTemAtualizacao,
        dados: { ...c, tem_atualizacao_pos_retorno: finalTemAtualizacao }
      };
    });

    const chunkSize = 50;
    for (let i = 0; i < payload.length; i += chunkSize) {
      const chunk = payload.slice(i, i + chunkSize);
      const { error: upsertError } = await supabase
        .from('processos')
        .upsert(chunk, { onConflict: 'protocolo_ref, empresa_id' });
      if (upsertError) throw upsertError;
    }

    return { success: true, message: "Sincronia concluída." };
  } catch (error: any) {
    console.error("[DB Sync Fail]", error.message);
    return { success: false, message: error.message };
  }
}

// --- GESTÃO DE NOTAS E EVIDÊNCIAS ---

export async function getStoredNotes(): Promise<CaseNote[]> {
  const { auth_id, empresa_id, isSupervisor } = await getUserContext();
  if (!empresa_id || !auth_id || !supabase) return [];
  try {
    let allData: any[] = [];
    let page = 0;
    const pageSize = 1000;
    let hasMore = true;
    while (hasMore) {
      let query = supabase.from('notes').select('*').eq('empresa_id', empresa_id).order('created_at', { ascending: false }).range(page * pageSize, (page + 1) * pageSize - 1);
      if (!isSupervisor) query = query.eq('created_by', auth_id);
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

export async function saveSingleNote(note: Partial<CaseNote>): Promise<{ success: boolean; data?: any }> {
  const { auth_id, empresa_id } = await getUserContext();
  if (!empresa_id || !auth_id || !supabase) return { success: false };
  const dbNote = { title: note.title || 'Nota', content: note.imageUrl ? JSON.stringify({ text: note.content, imageUrl: note.imageUrl }) : note.content, empresa_id: empresa_id, created_by: auth_id };
  const { data, error } = await supabase.from('notes').insert(dbNote).select().single();
  if (error) return { success: false };
  return { success: true, data };
}

export async function updateStoredNote(id: string, updates: Partial<CaseNote>): Promise<{ success: boolean }> {
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
  const { error } = await supabase.from('notes').delete().eq('id', id).eq('empresa_id', empresa_id);
  return { success: !error };
}

// --- GESTÃO DE EQUIPE (MANTIDAS) ---

export async function getEmpresaUsers(): Promise<UserProfile[]> {
  const { empresa_id } = await getUserContext();
  if (!empresa_id || !supabase) return [];
  const { data, error } = await supabase
    .from('usuarios')
    .select('*')
    .eq('empresa_id', empresa_id)
    .order('nome', { ascending: true });
  return (data as UserProfile[]) || [];
}

export async function createEmpresaUserAction(userData: any) {
  const { isSuperAdmin, empresa_id } = await getUserContext();
  if (!isSuperAdmin || !empresa_id) return { success: false, error: 'Permissão insuficiente.' };

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;

  if (!serviceKey || !url) return { success: false, error: 'Erro de configuração do servidor.' };

  const adminClient = createSupabaseClient(url, serviceKey);

  try {
    const { data: authUser, error: authError } = await adminClient.auth.admin.createUser({
      email: userData.email,
      password: userData.password,
      email_confirm: true,
      user_metadata: { full_name: userData.nome }
    });

    if (authError) throw authError;

    const { error: profileError } = await adminClient.from('usuarios').insert({
      auth_user_id: authUser.user.id,
      empresa_id: empresa_id,
      nome: userData.nome.toUpperCase(),
      email: userData.email.toLowerCase(),
      cargo: userData.cargo || 'Operador'
    });

    if (profileError) throw profileError;

    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

export async function removeEmpresaUser(id: string) {
  const { empresa_id, isSuperAdmin, isSupervisor } = await getUserContext();
  if (!isSuperAdmin && !isSupervisor) return { success: false, error: 'Permissão insuficiente.' };
  
  const { error } = await supabase
    .from('usuarios')
    .delete()
    .eq('id', id)
    .eq('empresa_id', empresa_id);
    
  return { success: !error, error: error?.message };
}

export async function updateUserRole(userId: string, newRole: UserRole) {
  const { empresa_id, isSuperAdmin, weight } = await getUserContext();
  
  // Validação de Hierarquia
  const targetWeight = ROLE_WEIGHTS[newRole] || 0;
  if (!isSuperAdmin && weight <= targetWeight) {
    return { success: false, error: 'Autoridade insuficiente para atribuir este cargo.' };
  }

  const { error } = await supabase
    .from('usuarios')
    .update({ cargo: newRole })
    .eq('id', userId)
    .eq('empresa_id', empresa_id);
    
  return { success: !error, error: error?.message };
}

// --- UTILITÁRIOS ---

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
  const { error } = await supabase.from('advogados_banca').update({ ativo: false }).eq('id', id).eq('empresa_id', empresa_id);
  return { success: !error };
}

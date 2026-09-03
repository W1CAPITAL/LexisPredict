'use server';

import { supabase, isSupabaseConfigured, UserProfile, UserRole, checkIfSuperAdmin, checkIfSupervisor, checkIfViewer } from './supabase';
import { LegalCase, formatDateToISO, processarCaso } from './case-logic';
import { resolveSituacaoFromRow, resolveStatusManualFromRow } from './resolve-situacao';
import { cookies } from 'next/headers';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { canSupervisaoCarteira, isSuperAdminProfile } from './auth-supervisao';

/**
 * REPOSITÓRIO CENTRAL LEXISPREDICT (v310.0 ELITE)
 * Governança de Visibilidade, Telemetria e Conhecimento.
 * Inclui paginação getStoredCasesPageForEmpresa + AuditoriaAcao com encerramento.
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
  if (!url || !key) throw new Error("Configuração de Admin ausente.");
  return createSupabaseClient(url, key);
}

export async function getUserContext() {
  const cookieStore = await cookies();
  const userEmail = cookieStore.get('lexis_user_email')?.value;
  
  if (!userEmail || !supabase) return { auth_id: null, empresa_id: null, cargo: null as UserRole | null, email: null, isSuperAdmin: false, isSupervisor: false, isViewer: false, isMasterView: false, isAdministrador: false, isEmpresaWide: false, weight: 0 };

  const { data: profile } = await supabase
    .from('usuarios')
    .select('id, empresa_id, cargo, email, auth_user_id')
    .eq('email', userEmail.toLowerCase().trim())
    .maybeSingle();
    
  const cargo = (profile?.cargo as UserRole) || 'Operador';
  const isSuperAdmin = isSuperAdminProfile(profile) || checkIfSuperAdmin(profile);
  const isSupervisor = canSupervisaoCarteira(profile) || checkIfSupervisor(profile);
  // Visão de carteira integral: Superadmin, Supervisor e Visualizador (vê empresa toda)
  const isViewer = checkIfViewer(profile) || /visualiz/i.test(String(profile?.cargo || ''));
  // Lote1: só Superadmin e Supervisor veem todos os casos.
  const isMasterView = isSuperAdmin || isSupervisor;
  const isAdministrador =
    /admin/i.test(String(profile?.cargo || cargo || '')) && !isViewer;
  const isEmpresaWide = isSuperAdmin || isSupervisor || isViewer || isAdministrador;

  return { 
    auth_id: profile?.auth_user_id || null,
    empresa_id: profile?.empresa_id || null, 
    cargo: cargo,
    email: profile?.email || null,
    isSuperAdmin,
    isSupervisor,
    isViewer,
    isMasterView,
    isAdministrador,
    isEmpresaWide,
    weight: ROLE_WEIGHTS[cargo] || 0
  };
}

export async function getStoredCases(): Promise<LegalCase[]> {
  const { empresa_id } = await getUserContext();
  if (!empresa_id) return [];
  return getStoredCasesForEmpresa(empresa_id);
}

function dedupeByProtocolo(cases: LegalCase[]): LegalCase[] {
  const seen = new Map<string, LegalCase>();
  for (const c of cases) {
    const key = String(c.protocolo || '').replace(/\D/g, '') || String(c.id || '');
    if (!key) continue;
    const prev = seen.get(key);
    if (!prev) {
      seen.set(key, c);
      continue;
    }
    // mantém o que tem mais sinal de atendimento/atualização
    const score = (x: any) =>
      (x.ultimoRetorno ? 10 : 0) + (x.tem_novo_andamento ? 5 : 0) + (x.created_by ? 2 : 0);
    if (score(c) >= score(prev)) seen.set(key, c);
  }
  return Array.from(seen.values());
}

function toLegalCase(item: any): LegalCase {
  const dados = (item.dados && typeof item.dados === 'object') ? item.dados : {};
  // Colunas tipadas vencem o JSON dados (evita atendimento "congelado" com data velha no blob)
  return processarCaso({
    ...dados,
    id: item.id.toString(),
    db_id: item.id.toString(),
    created_by: item.created_by,
    // situacao operacional (gabinete) — nunca status de prazo
    situacao: resolveSituacaoFromRow(item, dados),
    statusManual: resolveStatusManualFromRow(item, dados),
    status_interno: item.status_interno || dados.status_interno || resolveSituacaoFromRow(item, dados),
    via_scan_auto_encerrar: !!(dados.via_scan_auto_encerrar),
    protocolo: item.protocolo_ref || dados.protocolo || dados.PROTOCOLO,
    advogado: item.advogado ?? dados.advogado,
    escritorio: item.escritorio ?? dados.escritorio,
    status: item.status ?? dados.status,
    tribunal: item.tribunal ?? dados.tribunal,
    telefone: item.telefone ?? dados.telefone,
    observacao: item.observacoes ?? dados.observacao ?? dados.observacoes,
    // fonte de verdade do atendimento da semana
    ultimoRetorno: item.ultimo_retorno ?? dados.ultimoRetorno ?? dados.ultimo_retorno ?? dados.ULTIMO_RETORNO ?? null,
    auditado_em: item.auditado_em ?? dados.auditado_em ?? null,
    auditado_por: item.auditado_por ?? dados.auditado_por ?? null,
    atendido_por: item.atendido_por ?? dados.atendido_por ?? null,
    proximoPrazo: item.proximo_retorno ?? dados.proximoPrazo ?? dados.proximo_retorno ?? dados.PROXIMO_RETORNO ?? null,
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
    busca_apreensao_consultado_em: item.busca_apreensao_consultado_em,
    em_cumprimento_sentenca: item.em_cumprimento_sentenca ?? dados.em_cumprimento_sentenca,
    cumprimento_sentenca_motivo: item.cumprimento_sentenca_motivo ?? dados.cumprimento_sentenca_motivo,
    cumprimento_sentenca_consultado_em: item.cumprimento_sentenca_consultado_em ?? dados.cumprimento_sentenca_consultado_em,
    is_procedente: item.is_procedente ?? dados.is_procedente,
    procedente_motivo: item.procedente_motivo ?? dados.procedente_motivo,
    cumprimento_pendente_necessario: item.cumprimento_pendente_necessario ?? dados.cumprimento_pendente_necessario,
    cumprimento_ativo: item.cumprimento_ativo ?? dados.cumprimento_ativo,
    cumprimento_encerrado: item.cumprimento_encerrado ?? dados.cumprimento_encerrado,
    status_executivo: item.status_executivo ?? dados.status_executivo,
    detalhes_execucao: item.detalhes_execucao ?? dados.detalhes_execucao,
    data_transito_julgado: item.data_transito_julgado,
    djen_nova_comunicacao: item.djen_nova_comunicacao,
    djen_ultimo_resumo: item.djen_ultimo_resumo,
    djen_ultimo_link: item.djen_ultimo_link,
    djen_ultima_data: item.djen_ultima_data,
  });
}

export async function getStoredCasesForEmpresa(empresaId: string, isAdmin = false): Promise<LegalCase[]> {
  if (!isSupabaseConfigured) return [];
  if (!empresaId) return [];

  const context = await getUserContext();
  const { auth_id, isSuperAdmin, isSupervisor } = context as any;

  // isAdmin=true → /processos (empresa toda)
  // Superadmin/Supervisor → carteira completa em Cases/Dashboard
  // Operador/Admin → SOMENTE created_by = auth_id
  const wantAll = isAdmin === true || !!(isSuperAdmin || isSupervisor);

  const mapRows = (rows: any[]): LegalCase[] => {
    const out: LegalCase[] = [];
    for (const item of rows || []) {
      try {
        out.push(toLegalCase(item));
      } catch {
        try {
          const dados = (item?.dados && typeof item.dados === "object") ? item.dados : {};
          out.push(
            processarCaso({
              ...dados,
              id: String(item.id),
              db_id: String(item.id),
              created_by: item.created_by,
              protocolo: item.protocolo_ref || dados.protocolo || dados.PROTOCOLO || "",
              cliente: dados.cliente || dados.CLIENTE || "SEM NOME",
              ultimoRetorno: item.ultimo_retorno ?? dados.ultimoRetorno ?? null,
              atendido_por: item.atendido_por ?? dados.atendido_por ?? null,
            })
          );
        } catch { /* skip */ }
      }
    }
    return out;
  };

  const fetchPages = async (cli: any, mode: "all" | "mine") => {
    let allData: any[] = [];
    let page = 0;
    const pageSize = 500;
    let hasMore = true;
    while (hasMore) {
      let query = cli
        .from("processos")
        .select("*")
        .eq("empresa_id", empresaId)
        .order("created_at", { ascending: false })
        .range(page * pageSize, (page + 1) * pageSize - 1);
      if (mode === "mine") {
        if (!auth_id) return [];
        // Somente meus processos (created_by = auth_id)
        query = query.eq("created_by", auth_id);
      }
      const { data, error } = await query;
      if (error) throw error;
      if (data && data.length > 0) {
        allData = allData.concat(data);
        hasMore = data.length === pageSize;
        page++;
      } else {
        hasMore = false;
      }
    }
    return allData;
  };

  try {
    if (wantAll) {
      try {
        const admin = await getSupabaseAdmin();
        if (admin) {
          const rows = await fetchPages(admin, "all");
          if (rows.length > 0) return dedupeByProtocolo(mapRows(rows));
        }
      } catch (e) {
        console.error("[getStoredCasesForEmpresa] admin all", e);
      }
      try {
        if (supabase) {
          const rows = await fetchPages(supabase, "all");
          if (rows.length > 0) return dedupeByProtocolo(mapRows(rows));
        }
      } catch (e) {
        console.error("[getStoredCasesForEmpresa] user all", e);
      }
      return [];
    }

    if (!auth_id) return [];
    try {
      if (supabase) {
        const rows = await fetchPages(supabase, "mine");
        if (rows.length > 0) return dedupeByProtocolo(mapRows(rows));
      }
    } catch (e) {
      console.error("[getStoredCasesForEmpresa] user mine", e);
    }
    try {
      const admin = await getSupabaseAdmin();
      if (admin) {
        const rows = await fetchPages(admin, "mine");
        if (rows.length > 0) return dedupeByProtocolo(mapRows(rows));
      }
    } catch (e) {
      console.error("[getStoredCasesForEmpresa] admin mine", e);
    }
    return [];
  } catch (error) {
    console.error("[getStoredCasesForEmpresa]", error);
    return [];
  }
}

export async function getStoredCasesPageForEmpresa(
  empresaId: string,
  limit = 250,
  offset = 0,
  isAdmin = false,
  opts?: { onlyAtivos?: boolean }
): Promise<LegalCase[]> {
  if (!isSupabaseConfigured) return [];
  const client = isAdmin ? await getSupabaseAdmin() : supabase;
  if (!client) return [];

  try {
    const context = await getUserContext();
    const { auth_id, isMasterView } = context;
    const onlyAtivos = opts?.onlyAtivos === true;

    let query = client
      .from('processos')
      .select('*')
      .eq('empresa_id', empresaId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (onlyAtivos) {
      // PostgREST: not in (Arquivado, ENCERRADO, ...)
      query = query.not("status", "in", '("Arquivado","ENCERRADO","Extinto","SUSPENSO")');
    }

    if (!isAdmin && !isMasterView && !(context as any).isEmpresaWide && auth_id) {
      query = query.eq("created_by", auth_id);
    }

    const { data, error } = await query;
    if (error) throw error;

    return (data || []).map((item: any) => toLegalCase(item));
  } catch (error) {
    console.error("[getStoredCasesPageForEmpresa]", error);
    return [];
  }
}

export async function listKnowledgeDocs(empresaId: string) {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('knowledge_docs')
    .select('*')
    .eq('empresa_id', empresaId)
    .order('created_at', { ascending: false });
  return data || [];
}

export async function deleteKnowledgeDoc(docId: string, empresaId: string) {
  const admin = await getSupabaseAdmin();
  await admin.from('knowledge_chunks').delete().eq('doc_id', docId).eq('empresa_id', empresaId);
  const { error } = await admin.from('knowledge_docs').delete().eq('id', docId).eq('empresa_id', empresaId);
  return { success: !error };
}

export async function saveKnowledgeDocSystem(doc: any) {
  const admin = await getSupabaseAdmin();
  const payload = {
    titulo: doc.titulo,
    tipo: doc.tipo,
    tags: doc.tags,
    uso_despacho: !!doc.uso_despacho,
    storage_path: doc.storage_path,
    empresa_id: doc.empresa_id,
    created_by: doc.created_by,
    ativo: doc.ativo ?? true
  };
  
  const { data, error } = await admin.from('knowledge_docs').insert(payload).select().single();
  return { success: !error, data, error };
}

export async function saveKnowledgeChunksSystem(chunks: any[]) {
  const admin = await getSupabaseAdmin();
  const payload = chunks.map(c => ({
    doc_id: c.doc_id,
    empresa_id: c.empresa_id,
    secao: c.secao,
    texto: c.texto,
    tags: c.tags,
    uso_despacho: !!c.uso_despacho
  }));
  
  const { error } = await admin.from('knowledge_chunks').insert(payload);
  return { success: !error, error };
}

export async function searchKnowledgeChunksSystem(keywords: string[], empresaId: string) {
  const admin = await getSupabaseAdmin();
  const { data, error } = await admin
    .from('knowledge_chunks')
    .select('*')
    .eq('empresa_id', empresaId)
    .containedBy('tags', keywords)
    .limit(5);
    
  return { success: !error, data, error };
}

function mapProcessoRow(item: any): LegalCase {
  const dados = (item.dados && typeof item.dados === 'object') ? item.dados : {};
  const situacao = resolveSituacaoFromRow(item, dados);
  const statusManual = resolveStatusManualFromRow(item, dados, situacao);
  return processarCaso({
    ...dados,
    id: item.id.toString(),
    db_id: item.id.toString(),
    empresa_id: item.empresa_id,
    created_by: item.created_by,
    situacao,
    statusManual,
    status_interno: item.status_interno || dados.status_interno || situacao,
    via_scan_auto_encerrar: !!(dados.via_scan_auto_encerrar),
    ultimoRetorno: item.ultimo_retorno,
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
    busca_apreensao_consultado_em: item.busca_apreensao_consultado_em,
    em_cumprimento_sentenca: item.em_cumprimento_sentenca,
    cumprimento_sentenca_motivo: item.cumprimento_sentenca_motivo,
    cumprimento_sentenca_consultado_em: item.cumprimento_sentenca_consultado_em,
    is_procedente: item.is_procedente ?? item.dados?.is_procedente,
    cumprimento_pendente_necessario: item.cumprimento_pendente_necessario ?? item.dados?.cumprimento_pendente_necessario,
    status_executivo: item.status_executivo ?? item.dados?.status_executivo,
    djen_nova_comunicacao: item.djen_nova_comunicacao,
    djen_ultimo_resumo: item.djen_ultimo_resumo,
    djen_ultimo_link: item.djen_ultimo_link,
    djen_ultima_data: item.djen_ultima_data,
    dados: item.dados,
  });
}

export async function getGlobalPendingProcessesSystem(
  limit: number,
  empresaId: string,
  opts?: { scope?: 'full' | 'cumprimento' }
): Promise<LegalCase[]> {
  const scope = opts?.scope === 'cumprimento' ? 'cumprimento' : 'full';

  const admin = await getSupabaseAdmin();
  const statusExcluidos = ['ENCERRADO', 'Arquivado', 'EXTINTO', 'SUSPENSO', 'IMOVEL', 'IMÓVEL', 'finalizado'];
  const statusFilter = `(${statusExcluidos.map(s => `"${s}"`).join(',')})`;

  // Reserva ~1/3 do lote para ENCERRADOS (cumprimento / falta instaurar), resto ativos
  const slotsEnc = Math.max(1, Math.floor(limit / 3));
  const slotsAtivos = Math.max(1, limit - slotsEnc);

  const { data: ativos, error } = await admin
    .from('processos')
    .select('*')
    .eq('empresa_id', empresaId)
    .not('status', 'in', statusFilter)
    .order('scan_priority', { ascending: false })
    .order('datajud_consultado_em', { ascending: true, nullsFirst: true })
    .limit(slotsAtivos);

  if (error) return [];

  const out: LegalCase[] = (ativos || []).map(mapProcessoRow);

  // ENCERRADOS operacionais ainda sem flag executiva (ou nunca consultados no DataJud)
  const { data: encerrados } = await admin
    .from('processos')
    .select('*')
    .eq('empresa_id', empresaId)
    .in('status', statusExcluidos)
    .order('datajud_consultado_em', { ascending: true, nullsFirst: true })
    .limit(slotsEnc * 4);

  for (const item of encerrados || []) {
    if (out.length >= limit) break;
    const dados = (item.dados && typeof item.dados === 'object' ? item.dados : {}) as any;
    const ja =
      item.is_procedente ||
      item.em_cumprimento_sentenca ||
      item.cumprimento_pendente_necessario ||
      dados.is_procedente ||
      dados.em_cumprimento_sentenca ||
      dados.cumprimento_pendente_necessario ||
      dados.status_executivo ||
      dados.cumprimento_encerrado ||
      dados.cumprimento_ativo;
    // Já analisado e já consultado → pula (evita loop eterno)
    if (ja && item.datajud_consultado_em) continue;
    out.push(mapProcessoRow(item));
  }

  // Se ainda sobrar vaga (poucos encerrados), completa com mais ativos
  if (out.length < limit) {
    const ids = new Set(out.map((c) => String(c.id || (c as any).db_id)));
    const { data: maisAtivos } = await admin
      .from('processos')
      .select('*')
      .eq('empresa_id', empresaId)
      .not('status', 'in', statusFilter)
      .order('datajud_consultado_em', { ascending: true, nullsFirst: true })
      .limit(limit * 2);
    for (const item of maisAtivos || []) {
      if (out.length >= limit) break;
      if (ids.has(String(item.id))) continue;
      out.push(mapProcessoRow(item));
    }
  }

  if (scope === 'cumprimento') {
    const { isCandidatoCumprimentoScan } = await import('@/lib/scan-scope-cumprimento');
    let filtered = out.filter((c) => isCandidatoCumprimentoScan(c));

    // Lote4: se o micro-lote genérico não trouxe candidatos, busca DIRETO no banco
    // (flags executivas / procedente / baixa) — não faz fallback silencioso para Full
    if (filtered.length === 0) {
      const { data: cand } = await admin
        .from('processos')
        .select('*')
        .eq('empresa_id', empresaId)
        .or(
          [
            'is_procedente.eq.true',
            'em_cumprimento_sentenca.eq.true',
            'cumprimento_pendente_necessario.eq.true',
            'datajud_encerrado_tribunal.eq.true',
          ].join(',')
        )
        .order('datajud_consultado_em', { ascending: true, nullsFirst: true })
        .limit(limit * 3);

      const mapped = (cand || []).map(mapProcessoRow);
      filtered = mapped.filter((c) => isCandidatoCumprimentoScan(c));
      if (filtered.length === 0) {
        // ainda vazio: prioriza nunca auditados (descoberta de procedência)
        const { data: never } = await admin
          .from('processos')
          .select('*')
          .eq('empresa_id', empresaId)
          .is('datajud_consultado_em', null)
          .order('created_at', { ascending: false })
          .limit(limit);
        filtered = (never || []).map(mapProcessoRow);
      }
    }

    // Prioriza: pendente > procedente sem fase > em cumprimento > resto
    filtered.sort((a, b) => {
      const score = (c: any) => {
        const d = c.dados && typeof c.dados === 'object' ? c.dados : {};
        if (c.cumprimento_pendente_necessario || d.cumprimento_pendente_necessario) return 0;
        if ((c.is_procedente || d.is_procedente) && !(c.em_cumprimento_sentenca || d.em_cumprimento_sentenca))
          return 1;
        if (c.em_cumprimento_sentenca || d.em_cumprimento_sentenca) return 2;
        return 3;
      };
      return score(a) - score(b);
    });

    return filtered.slice(0, limit);
  }

  return out;
}

export async function getScanStatusMetrics(empresaId: string) {
  const admin = await getSupabaseAdmin();
  const statusExcluidos = ['ENCERRADO', 'Arquivado', 'EXTINTO', 'SUSPENSO', 'IMOVEL', 'IMÓVEL', 'finalizado'];
  const statusFilter = `(${statusExcluidos.map(s => `"${s}"`).join(',')})`;

  const { count: total } = await admin
    .from('processos')
    .select('*', { count: 'exact', head: true })
    .eq('empresa_id', empresaId);

  // Carteira ativa (não encerrada no gabinete)
  const { count: active } = await admin
    .from('processos')
    .select('*', { count: 'exact', head: true })
    .eq('empresa_id', empresaId)
    .not('status', 'in', statusFilter);

  // Ainda sem nenhuma consulta DataJud
  const { count: neverScanned } = await admin
    .from('processos')
    .select('*', { count: 'exact', head: true })
    .eq('empresa_id', empresaId)
    .not('status', 'in', statusFilter)
    .is('datajud_consultado_em', null);

  const activeN = active || 0;
  const pendingN = neverScanned || 0;
  const auditedN = Math.max(0, activeN - pendingN);

  const { count: alerts } = await admin
    .from('processos')
    .select('*', { count: 'exact', head: true })
    .eq('empresa_id', empresaId)
    .eq('tem_atualizacao_pos_retorno', true);

  const { count: djenAlerts } = await admin
    .from('processos')
    .select('*', { count: 'exact', head: true })
    .eq('empresa_id', empresaId)
    .eq('djen_nova_comunicacao', true);

  const { count: closed } = await admin
    .from('processos')
    .select('*', { count: 'exact', head: true })
    .eq('empresa_id', empresaId)
    .eq('datajud_encerrado_tribunal', true);

  const { data: recent } = await admin
    .from('processos')
    .select('protocolo_ref, tem_atualizacao_pos_retorno, datajud_encerrado_tribunal, djen_nova_comunicacao, datajud_ultimo_nome, datajud_consultado_em')
    .eq('empresa_id', empresaId)
    .not('datajud_consultado_em', 'is', null)
    .order('datajud_consultado_em', { ascending: false })
    .limit(10);

  return {
    total: total || 0,
    pending: pendingN,
    alerts: alerts || 0,
    djenAlerts: djenAlerts || 0,
    closed: closed || 0,
    audited: auditedN,
    recentLogs: recent?.map(r => ({
      protocolo: r.protocolo_ref,
      message: r.datajud_encerrado_tribunal
        ? 'BAIXA NO TRIBUNAL'
        : (r.tem_atualizacao_pos_retorno || r.djen_nova_comunicacao)
          ? 'NOVA MOVIMENTAÇÃO'
          : 'Monitoramento Regular',
      success: true,
      latency: 0,
      type: r.datajud_encerrado_tribunal
        ? 'closed'
        : (r.tem_atualizacao_pos_retorno || r.djen_nova_comunicacao)
          ? 'update'
          : 'ok',
      engine: 'Nuvem'
    })) || []
  };
}

export async function updateCaseDataJudSystem(caseId: string, patch: any) {
  const admin = await getSupabaseAdmin();

  const { data: current, error: fetchError } = await admin
    .from('processos')
    .select('dados, empresa_id, protocolo_ref')
    .eq('id', caseId)
    .single();

  if (fetchError || !current) {
    console.error('[updateCaseDataJudSystem] fetch', fetchError);
    return { success: false, error: fetchError?.message };
  }

  // Scanner/DataJud NUNCA pode apagar atendimento humano
  const ATENDIMENTO_KEYS = [
    'ultimoRetorno', 'ultimo_retorno', 'ULTIMO_RETORNO',
    'atendido_por', 'atendidoPor', 'atendido_em',
    'proximoPrazo', 'proximo_retorno', 'PROXIMO_RETORNO',
  ] as const;
  const safePatch: Record<string, any> = { ...(patch || {}) };
  for (const k of ATENDIMENTO_KEYS) {
    if (k in safePatch) delete safePatch[k];
  }
  // Scanner / flags NUNCA alteram dono do processo
  delete safePatch['created_by'];
  delete safePatch['createdBy'];

  // evento_tipo, tem_novo_andamento, etc. ficam no JSON dados
  // Preserva ultimoRetorno / atendido_por já gravados no blob
  const prevDados = (current.dados && typeof current.dados === 'object' ? current.dados : {}) as any;
  const nestedDados =
    safePatch.dados && typeof safePatch.dados === 'object' ? { ...safePatch.dados } : {};
  const flatPatch = { ...safePatch };
  delete flatPatch.dados;
  const updatedDados: Record<string, any> = {
    ...prevDados,
    ...flatPatch,
    ...nestedDados,
  };
  for (const k of ATENDIMENTO_KEYS) {
    if (prevDados[k] != null && prevDados[k] !== '' && (updatedDados[k] == null || updatedDados[k] === '')) {
      updatedDados[k] = prevDados[k];
    }
  }
  // Auto-encerrar scanner: grava situacao legível + flag W1 + coluna status
  let forceArquivado = false;
  if (flatPatch.via_scan_auto_encerrar || nestedDados.via_scan_auto_encerrar || updatedDados.via_scan_auto_encerrar) {
    forceArquivado = true;
    updatedDados.situacao = 'ENCERRADO';
    updatedDados.statusManual = 'Encerrado';
    updatedDados.status = 'Arquivado';
    updatedDados.status_interno = 'ENCERRADO';
    updatedDados.via_scan_auto_encerrar = true;
    if (!updatedDados.operacao_sistema) {
      updatedDados.operacao_sistema = {
        origem: 'W1_CONTROL',
        perfil: 'W1 CONTROL',
        tipo: 'SCAN_AUTO_ENCERRAR',
        legenda: 'Feito por Davi Alves Figueredo · scanner automático',
      };
    }
    if (!updatedDados.auditado_por_nome) updatedDados.auditado_por_nome = 'W1 CONTROL';
  }

  const row: Record<string, any> = {
    dados: updatedDados,
  };
  if (forceArquivado) {
    row.status = 'Arquivado';
    row.status_interno = 'ENCERRADO';
  }

  const colunasReais = [
    'tem_atualizacao_pos_retorno',
    'djen_nova_comunicacao',
    'datajud_ultimo_movimento',
    'datajud_ultimo_nome',
    'datajud_consultado_em',
    'datajud_encerrado_tribunal',
    'datajud_encerrado_motivo',
    'datajud_hash',
    'indicio_busca_apreensao',
    'busca_apreensao_confianca',
    'busca_apreensao_motivo',
    'busca_apreensao_consultado_em',
    'em_cumprimento_sentenca',
    'cumprimento_sentenca_motivo',
    'cumprimento_sentenca_consultado_em',
    // status_executivo / cumprimento_ativo / cumprimento_encerrado / detalhes_execucao → só em dados JSONB
    'is_procedente',
    'procedente_motivo',
    'cumprimento_pendente_necessario',
    'data_transito_julgado',
    'djen_ultima_data',
    'djen_ultimo_resumo',
    'djen_ultimo_link',
    'djen_count',
    'djen_consultado_em',
    'tribunal',
    'scan_priority',
    'datajud_last_ok',
    'djen_last_ok',
    'datajud_last_error',
    'djen_last_error',
    'alert_ack_at',
    'alert_delivered_at',
  ] as const;

  for (const k of colunasReais) {
    if (patch[k] !== undefined) {
      row[k] = patch[k];
    }
  }

    let { error } = await admin.from('processos').update(row).eq('id', caseId);

  if (error && /does not exist|column/i.test(error.message || '')) {
    console.warn('[updateCaseDataJudSystem] retry só dados:', error.message);
    const safe: Record<string, any> = { dados: updatedDados };
    for (const k of ['em_cumprimento_sentenca','cumprimento_sentenca_motivo','datajud_ultimo_movimento','datajud_ultimo_nome','datajud_consultado_em','datajud_encerrado_tribunal','datajud_encerrado_motivo','tribunal','is_procedente','procedente_motivo','cumprimento_pendente_necessario']) {
      if (row[k] !== undefined) safe[k] = row[k];
    }
    const retry = await admin.from('processos').update(safe).eq('id', caseId);
    error = retry.error;
  }

  if (error) {
    console.error('[updateCaseDataJudSystem] update', error);
    return { success: false, error: error.message };
  }

  // Trigger automático de log (tribunal) — não bloqueia o fluxo
  try {
    const temDj = patch?.datajud_consultado_em != null;
    const temDjen = patch?.djen_consultado_em != null || patch?.djen_nova_comunicacao === true;
    if ((temDj || temDjen) && current?.empresa_id && current?.protocolo_ref) {
      await logAuditoriaSistema({
        empresaId: current.empresa_id,
        acao: temDj ? 'scan_datajud' : 'scan_djen',
        protocolo: String(current.protocolo_ref),
        userNome: 'Scanner',
        detalhes: {
          via: 'updateCaseDataJudSystem',
          datajud_consultado_em: patch?.datajud_consultado_em || null,
          djen_consultado_em: patch?.djen_consultado_em || null,
          tem_novo_andamento: !!patch?.tem_novo_andamento,
          datajud_encerrado_tribunal: !!patch?.datajud_encerrado_tribunal,
        },
      });
    }
  } catch { /* ignore */ }

  return { success: true };
}

export async function saveStoredCasesForEmpresa(cases: LegalCase[], empresaId: string, isAdmin = false): Promise<{ success: boolean; message: string }> {
  try {
    const { auth_id } = await getUserContext();
    const client = isAdmin ? await getSupabaseAdmin() : (supabase || (await getSupabaseAdmin()));
    if (!client) return { success: false, message: 'Cliente indisponível.' };

    // Mapa de donos já gravados — NUNCA sobrescrever no upsert em lote
    const protos = (cases || []).map((c) => c.protocolo).filter(Boolean);
    const ownerByProto = new Map<string, string>();
    if (protos.length) {
      const chunk = 200;
      for (let i = 0; i < protos.length; i += chunk) {
        const slice = protos.slice(i, i + chunk);
        const { data: rows } = await client
          .from('processos')
          .select('protocolo_ref, created_by')
          .eq('empresa_id', empresaId)
          .in('protocolo_ref', slice);
        for (const r of rows || []) {
          if (r.created_by) ownerByProto.set(String(r.protocolo_ref), String(r.created_by));
        }
      }
    }

    const payload = (cases || []).map((c) => {
      const owner =
        ownerByProto.get(String(c.protocolo)) ||
        (c as any).created_by ||
        auth_id ||
        null;
      return {
        empresa_id: empresaId,
        // Só envia created_by se ainda não existe dono no banco (insert)
        ...(ownerByProto.has(String(c.protocolo))
          ? {}
          : owner
            ? { created_by: owner }
            : {}),
        protocolo_ref: c.protocolo,
        advogado: c.advogado || 'NÃO ATRIBUÍDO',
        escritorio: c.escritorio || null,
        status: c.status || 'Sem Prazo',
        risco: (c as any).risco || 'Normal',
        proximo_retorno: formatDateToISO(c.proximoPrazo),
        ultimo_retorno: formatDateToISO(c.ultimoRetorno),
        tribunal: c.tribunal || 'Outros',
        telefone: c.telefone || '',
        observacoes: c.observacao || '',
        datajud_ultimo_movimento: c.datajud_ultimo_movimento,
        datajud_ultimo_nome: c.datajud_ultimo_nome,
        datajud_consultado_em: c.datajud_consultado_em,
        tem_atualizacao_pos_retorno: !!c.tem_atualizacao_pos_retorno,
        datajud_encerrado_tribunal: !!c.datajud_encerrado_tribunal,
        datajud_encerrado_motivo: c.datajud_encerrado_motivo,
        datajud_hash: c.datajud_hash || null,
        indicio_busca_apreensao: !!c.indicio_busca_apreensao,
        busca_apreensao_confianca: c.busca_apreensao_confianca,
        busca_apreensao_motivo: c.busca_apreensao_motivo,
        busca_apreensao_consultado_em: c.busca_apreensao_consultado_em,
        em_cumprimento_sentenca: !!c.em_cumprimento_sentenca,
        cumprimento_sentenca_motivo: c.cumprimento_sentenca_motivo,
        cumprimento_sentenca_consultado_em: c.cumprimento_sentenca_consultado_em,
        djen_nova_comunicacao: !!c.djen_nova_comunicacao,
        djen_ultimo_resumo: c.djen_ultimo_resumo,
        djen_ultimo_link: c.djen_ultimo_link,
        djen_ultima_data: c.djen_ultima_data,
        dados: { ...c, created_by: owner },
      };
    });

    const chunkSize = 50;
    for (let i = 0; i < payload.length; i += chunkSize) {
      const chunk = payload.slice(i, i + chunkSize);
      // upsert sem created_by quando já existe: Postgres upsert replaces columns sent —
      // por isso omitimos created_by se já há dono (mapa).
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
      let query = supabase
        .from('notes')
        .select('*')
        .eq('empresa_id', empresa_id)
        .order('created_at', { ascending: false })
        .range(page * pageSize, (page + 1) * pageSize - 1);

      if (!hasFullAccess) {
        query = query.eq("created_by", auth_id);
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
      let imageUrl;
      let displayContent = item.content || '';
      try { 
        if (displayContent.startsWith('{')) { 
          const parsed = JSON.parse(displayContent); 
          displayContent = parsed.text; 
          imageUrl = parsed.imageUrl; 
        } 
      } catch (e) {}
      return { 
        id: item.id.toString(), 
        title: item.title || 'Nota', 
        content: displayContent, 
        imageUrl: imageUrl, 
        color: 'bg-white', 
        updatedAt: new Date(item.created_at).toLocaleString('pt-BR') 
      };
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
  try {
    const { fetchMessagesByPhone } = await import('@/lib/whatsapp-persist');
    const { messages, error } = await fetchMessagesByPhone(phone);
    if (error) {
      console.error('[getWhatsAppHistory]', error);
      return [];
    }
    return messages || [];
  } catch (e) {
    console.error('[getWhatsAppHistory]', e);
    return [];
  }
}

export async function listAdvogadosBanca() {
  try {
    const { empresa_id } = await getUserContext();
    if (!empresa_id || !supabase) return [];
    const { data, error } = await supabase
      .from("advogados_banca")
      .select("*")
      .eq("empresa_id", empresa_id)
      .eq("ativo", true)
      .order("nome", { ascending: true });
    if (error) {
      console.warn("[listAdvogadosBanca]", error.message);
      return [];
    }
    return data || [];
  } catch (e) {
    console.warn("[listAdvogadosBanca]", e);
    return [];
  }
}

export async function upsertAdvogadoBanca(adv: any) {
  try {
    const { empresa_id } = await getUserContext();
    if (!empresa_id || !supabase) {
      return { success: false, error: "offline_or_session", offline: true as const };
    }
    const payload = {
      ...adv,
      empresa_id,
      ativo: adv.ativo ?? true,
      estado_civil: adv.estado_civil ?? adv.estadoCivil ?? null,
      nacionalidade: adv.nacionalidade ?? null,
    };
    const { data, error } = await supabase
      .from("advogados_banca")
      .upsert(payload, { onConflict: "id" })
      .select()
      .single();
    if (error) return { success: false, error: error.message, offline: false as const };
    return { success: true, data };
  } catch (e: any) {
    return { success: false, error: e?.message || "erro", offline: true as const };
  }
}

export async function desativarAdvogadoBanca(id: string) {
  try {
    const { empresa_id } = await getUserContext();
    if (!empresa_id || !supabase) return { success: false, offline: true as const };
    const { error } = await supabase
      .from("advogados_banca")
      .update({ ativo: false })
      .eq("id", id)
      .eq("empresa_id", empresa_id);
    return { success: !error, offline: false as const };
  } catch {
    return { success: false, offline: true as const };
  }
}

/**
 * AUDITORIA OPERACIONAL — registra quem editou, apagou ou atendeu cada processo.
 * Tabela: auditoria_logs_app (ver src/lib/migration-auditoria.sql).
 * Falhas silenciosas: se a tabela ainda não existir, o app continua funcionando.
 */

export async function getCurrentUserNome(): Promise<string | null> {
  try {
    const { auth_id, empresa_id } = await getUserContext();
    if (!auth_id || !empresa_id || !supabase) return null;
    const { data } = await supabase
      .from('usuarios')
      .select('nome')
      .eq('auth_user_id', auth_id)
      .eq('empresa_id', empresa_id)
      .maybeSingle();
    return data?.nome || null;
  } catch { return null; }
}

export async function getProfileByAuthId(
  authId: string
): Promise<{ nome: string; cargo?: string | null; role?: string | null } | null> {
  try {
    const { empresa_id } = await getUserContext();
    if (!empresa_id || !supabase || !authId) return null;
    const { data } = await supabase
      .from('usuarios')
      .select('nome, cargo, role')
      .eq('auth_user_id', authId)
      .eq('empresa_id', empresa_id)
      .maybeSingle();
    return data
      ? { nome: data.nome, cargo: (data as any).cargo, role: (data as any).role }
      : null;
  } catch {
    return null;
  }
}

export type AuditoriaAcao = 'atendimento' | 'edicao' | 'exclusao' | 'criacao' | 'encerramento' | 'exportacao' | 'scan_datajud' | 'scan_djen' | 'auditoria';


/** Log de auditoria sem depender de cookie (cron/worker) — usa service role. */
export async function logAuditoriaSistema(params: {
  empresaId: string;
  authUserId?: string | null;
  userNome?: string | null;
  acao: AuditoriaAcao;
  protocolo: string;
  detalhes?: Record<string, any>;
}): Promise<void> {
  try {
    if (!params.empresaId || !params.protocolo) return;
    // Híbrido: não inflar auditoria_logs_app com scan automático
    try {
      const { hybridSkipScanAudit } = await import("@/lib/hybrid/policy");
      if (hybridSkipScanAudit() && /^scan_/.test(String(params.acao || ""))) return;
    } catch { /* */ }
    const admin = await getSupabaseAdmin();
    await admin.from('auditoria_logs_app').insert({
      empresa_id: params.empresaId,
      auth_user_id: params.authUserId || null,
      user_nome: params.userNome || 'Sistema',
      action: params.acao,
      protocolo_ref: params.protocolo,
      detalhes: params.detalhes || {},
    });
  } catch (e: any) {
    console.warn('[auditoria-sistema]', e?.message);
  }
}

export async function registrarAuditoriaAction(
  acao: AuditoriaAcao,
  protocolos: string[],
  detalhes: Record<string, any> = {}
): Promise<{ success: boolean }> {
  try {
    const { empresa_id, auth_id } = await getUserContext();
    if (!empresa_id) return { success: false };

    const nome = await getCurrentUserNome();
    const alvos = (protocolos || [])
      .map((p) => String(p).trim())
      .filter(Boolean);

    if (!alvos.length) return { success: false };

    const admin = await getSupabaseAdmin();
    const rows = alvos.map((protocolo_ref) => ({
      empresa_id,
      auth_user_id: auth_id || null,
      user_nome: nome || '—',
      action: acao,
      protocolo_ref,
      detalhes: detalhes || {},
    }));

    const { error } = await admin.from('auditoria_logs_app').insert(rows);
    if (error) {
      console.warn('[auditoria] tabela ausente ou erro:', error.message);
      return { success: false };
    }
    return { success: true };
  } catch (e: any) {
    console.warn('[auditoria]', e?.message);
    return { success: false };
  }
}

export async function fetchAuditoriaLogsAction(
  empresaId?: string,
  limit = 3000
): Promise<any[]> {
  try {
    const ctx = await getUserContext();
    const empresa = empresaId || ctx.empresa_id;
    if (!empresa || !supabase) return [];

    const { data, error } = await supabase
      .from('auditoria_logs_app')
      .select('*')
      .eq('empresa_id', empresa)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) return [];
    return data || [];
  } catch { return []; }
}

export async function clearDataJudAuditAction(protocolo: string) {
  const { empresa_id } = await getUserContext();
  if (!empresa_id || !supabase) return { success: false };
  
  const { data: dbItem } = await supabase.from('processos').select('id, dados').eq('protocolo_ref', protocolo).eq('empresa_id', empresa_id).single();
  if (!dbItem) return { success: false };

  const patch = {
    tem_atualizacao_pos_retorno: false,
    djen_nova_comunicacao: false,
    tem_novo_andamento: false
  };

  const updatedDados = { ...(dbItem.dados as any), ...patch };
  
  const { error } = await supabase.from('processos').update({ ...patch, dados: updatedDados }).eq('id', dbItem.id);
  return { success: !error };
}

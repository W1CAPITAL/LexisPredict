
'use server';

import { 
  getStoredCasesForEmpresa, 
  saveStoredCasesForEmpresa, 
  getUserContext, 
  getStoredNotes, 
  getEmpresaUsers 
} from '@/lib/server-db';
import { createClient } from '@/lib/supabase/server';
import { LegalCase, processarCaso } from '@/lib/case-logic';
import { isCasoEncerrado } from '@/lib/status-encerrado';
import { fetchDataJud } from '@/lib/datajud';
import { detectarAtualizacaoPosRetorno, detectarEncerradoNoTribunal, gerarHashAuditoria } from '@/lib/datajud-sync';
import { analisarBuscaApreensao } from '@/lib/busca-apreensao';

/**
 * @fileOverview Actions de Processos v420.0 ELITE - Suporte a Integridade por Hash
 */

export async function fetchRepoCases() {
  const { empresa_id } = await getUserContext();
  if (!empresa_id) return [];
  return await getStoredCasesForEmpresa(empresa_id);
}

export async function fetchRepoNotes() {
  return await getStoredNotes();
}

export async function syncRepoCases(cases: LegalCase[]) {
  const { empresa_id } = await getUserContext();
  if (!empresa_id) return { success: false, message: "Sessão expirada." };
  return await saveStoredCasesForEmpresa(cases, empresa_id);
}

export async function recalibrateCasesAction(alertLimit: number = 3) {
  try {
    const { empresa_id } = await getUserContext();
    if (!empresa_id) return { success: false, error: "Sessão expirada." };
    const cases = await getStoredCasesForEmpresa(empresa_id);
    const updatedCases = cases.map(c => isCasoEncerrado(c) ? c : processarCaso({ ...c, statusManual: 'Automatico' }, { alertLimit }));
    await saveStoredCasesForEmpresa(updatedCases, empresa_id);
    return { success: true, count: updatedCases.length, message: "Urgências recalculadas." };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

export async function fetchTeamPerformanceAction() {
  try {
    const { empresa_id } = await getUserContext();
    if (!empresa_id) return { users: [], cases: [] };
    const [users, cases] = await Promise.all([
      getEmpresaUsers(),
      getStoredCasesForEmpresa(empresa_id, true)
    ]);
    return { users, cases };
  } catch (e: any) {
    return { users: [], cases: [] };
  }
}

/**
 * Auditador de Registro Único (Utilizado pelo Scanner e Clique Manual)
 * Otimizado com Hashing de Integridade para detectar mudanças reais de conteúdo.
 */
export async function scanOneDataJudAction(protocolo: string, fast = true) {
  try {
    const { empresa_id, auth_id } = await getUserContext();
    if (!empresa_id || !auth_id) {
       return { success: false, protocolo, error: "401_SESSAO_EXPIRADA", message: "Sessão expirada" };
    }

    const supabase = await createClient();
    if (!supabase) throw new Error("Supabase indisponível.");

    const { data: dbItem, error: fetchError } = await supabase
      .from('processos')
      .select('*')
      .eq('protocolo_ref', protocolo)
      .eq('empresa_id', empresa_id)
      .maybeSingle();

    if (fetchError || !dbItem) {
      return { success: false, protocolo, error: "NOT_FOUND", message: "Processo não localizado" };
    }

    const target = processarCaso({
      ...(dbItem.dados as any),
      id: dbItem.id.toString(),
      created_by: dbItem.created_by,
      proximoPrazo: dbItem.proximo_retorno || '',
      ultimoRetorno: dbItem.ultimo_retorno || '',
      datajud_ultimo_movimento: dbItem.datajud_ultimo_movimento,
      datajud_ultimo_nome: dbItem.datajud_ultimo_nome,
      datajud_consultado_em: dbItem.datajud_consultado_em,
      tem_atualizacao_pos_retorno: dbItem.tem_atualizacao_pos_retorno,
      datajud_encerrado_tribunal: dbItem.datajud_encerrado_tribunal,
      datajud_encerrado_motivo: dbItem.datajud_encerrado_motivo,
      datajud_hash: dbItem.datajud_hash,
      indicio_busca_apreensao: dbItem.indicio_busca_apreensao,
      busca_apreensao_confianca: dbItem.busca_apreensao_confianca,
      busca_apreensao_motivo: dbItem.busca_apreensao_motivo,
      busca_apreensao_consultado_em: dbItem.busca_apreensao_consultado_em
    });

    const dataJud = await fetchDataJud(protocolo, 1, { fast });
    const attempts = dataJud?.attempts || 1;
    
    if (dataJud && !dataJud.error && dataJud.movimentos) {
      const check = detectarAtualizacaoPosRetorno(target.ultimoRetorno, dataJud.movimentos);
      const enc = detectarEncerradoNoTribunal(dataJud.movimentos);
      const ba = analisarBuscaApreensao(dataJud);
      const newHash = gerarHashAuditoria(dataJud.movimentos);
      
      const patch = {
        datajud_ultimo_movimento: check.dataUltimo,
        datajud_ultimo_nome: check.nomeUltimo,
        datajud_consultado_em: new Date().toISOString(),
        tem_atualizacao_pos_retorno: !!check.alerta || newHash !== target.datajud_hash,
        datajud_encerrado_tribunal: !!enc.encerrado,
        datajud_encerrado_motivo: enc.motivo,
        datajud_hash: newHash,
        indicio_busca_apreensao: !!ba.indicio,
        busca_apreensao_confianca: ba.confianca,
        busca_apreensao_motivo: ba.motivo,
        busca_apreensao_consultado_em: ba.indicio ? new Date().toISOString() : null,
        tribunal: dataJud.tribunal || target.tribunal
      };

      const hasRealChange = 
        patch.datajud_hash !== target.datajud_hash ||
        patch.datajud_encerrado_tribunal !== !!target.datajud_encerrado_tribunal ||
        patch.indicio_busca_apreensao !== !!target.indicio_busca_apreensao;

      let msg = attempts > 1 ? `Auditado (Recuperado na T${attempts})` : "Auditado";

      if (!hasRealChange) {
        await supabase
          .from('processos')
          .update({ datajud_consultado_em: patch.datajud_consultado_em })
          .eq('id', dbItem.id);
        msg += " (Preservado)";
      } else {
        const updatedCase: LegalCase = { ...target, ...patch };
        await saveStoredCasesForEmpresa([updatedCase], empresa_id);
        msg += " (Mudança Detectada)";
      }
      
      let tipo = 'sem_novidade';
      if (enc.encerrado) {
        msg = `ENCERRADO NO TRIBUNAL — ${enc.motivo}`;
        tipo = 'encerrado';
      } else if (ba.indicio && ba.confianca === 'alta') {
        msg = `⚠ ALERTA BUSCA E APREENSÃO`;
        tipo = 'novo_andamento';
      } else if (patch.tem_atualizacao_pos_retorno) {
        msg = `NOVO ANDAMENTO — ${check.nomeUltimo || 'Identificado por Hash'}`;
        tipo = 'novo_andamento';
      }
      
      return { 
        success: true, 
        protocolo, 
        tipo,
        alerta: !!(patch.tem_atualizacao_pos_retorno || ba.indicio), 
        encerrado: !!enc.encerrado,
        message: msg,
        casePatch: patch,
        attempts
      };
    }
    
    return { 
      success: false, 
      protocolo, 
      tipo: 'erro', 
      message: dataJud?.message || "Erro no tribunal", 
      error: true, 
      isAuthError: dataJud?.isAuthError,
      attempts
    };
  } catch (e: any) {
    return { success: false, protocolo, tipo: 'erro', message: `Falha técnica`, error: true };
  }
}

export async function scanSingleCaseAction(protocolo: string) {
  return await scanOneDataJudAction(protocolo, false);
}

export async function runDataJudScanAction(targetEmpresaId?: string) {
  try {
    const ctx = await getUserContext();
    const empresa_id = targetEmpresaId || ctx.empresa_id;
    if (!empresa_id) return { success: false, error: "Sessão expirada." };

    const cases = await getStoredCasesForEmpresa(empresa_id);
    if (!cases || cases.length === 0) return { success: true, scanned: 0, updated: 0, message: "Nenhum processo." };

    const batch = cases.filter(c => !isCasoEncerrado(c)).slice(0, 30);
    let updatedCount = 0;
    for (const c of batch) {
      await scanOneDataJudAction(c.protocolo, true);
      updatedCount++;
    }
    return { success: true, scanned: batch.length, updated: updatedCount, message: `Auditados ${batch.length} registros.` };
  } catch (e: any) {
    return { success: false, error: "Falha na varredura." };
  }
}

export async function clearDataJudAuditAction() {
  try {
    const { empresa_id } = await getUserContext();
    if (!empresa_id) return { success: false };
    const cases = await getStoredCasesForEmpresa(empresa_id);
    const updated = cases.map(c => ({
      ...c,
      tem_atualizacao_pos_retorno: false,
      datajud_encerrado_tribunal: false,
      datajud_encerrado_motivo: null,
      datajud_consultado_em: null,
      datajud_ultimo_movimento: null,
      datajud_ultimo_nome: null,
      datajud_hash: null,
      indicio_busca_apreensao: false,
      busca_apreensao_confianca: null,
      busca_apreensao_motivo: null,
      busca_apreensao_consultado_em: null
    }));
    await saveStoredCasesForEmpresa(updated, empresa_id);
    return { success: true };
  } catch (e) {
    return { success: false };
  }
}

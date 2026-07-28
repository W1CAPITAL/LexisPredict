'use server';

import { getStoredCases, saveStoredCases, getUserContext, getStoredNotes } from '@/lib/server-db';
import { LegalCase, processarCaso } from '@/lib/case-logic';
import { createClient } from '@/lib/supabase/server';
import { isCasoEncerrado } from '@/lib/status-encerrado';
import { fetchDataJud } from '@/lib/datajud';
import { detectarAtualizacaoPosRetorno } from '@/lib/datajud-sync';

/**
 * @fileOverview Actions de Processos v2.5
 */

export async function fetchRepoCases() {
  return await getStoredCases();
}

export async function fetchRepoNotes() {
  return await getStoredNotes();
}

export async function syncRepoCases(cases: LegalCase[]) {
  return await saveStoredCases(cases);
}

/**
 * Motor de Varredura DataJud em Lote v1.0
 * Consulta os processos ativos para identificar movimentações novas no tribunal.
 */
export async function runDataJudScanAction() {
  try {
    const { empresa_id, auth_id } = await getUserContext();
    if (!empresa_id || !auth_id) return { success: false, error: "Sessão expirada." };

    const cases = await getStoredCases();
    if (!cases || cases.length === 0) return { success: true, count: 0 };

    // Filtrar apenas processos ativos (não encerrados)
    const activeCases = cases.filter(c => !isCasoEncerrado(c));
    
    // Limitar lote a 20 por execução manual para não estourar rate limit
    const batch = activeCases.slice(0, 20);
    let updatedCount = 0;

    const results = [];

    for (const c of batch) {
      // Pequeno delay entre requests para cortesia com a API do CNJ
      await new Promise(r => setTimeout(r, 400));

      const dataJud = await fetchDataJud(c.protocolo);
      
      if (dataJud && !dataJud.error && dataJud.movimentos) {
        const check = detectarAtualizacaoPosRetorno(c.ultimoRetorno, dataJud.movimentos);
        
        const updatedCase: LegalCase = {
          ...c,
          datajud_ultimo_movimento: check.dataUltimo,
          datajud_ultimo_nome: check.nomeUltimo,
          datajud_consultado_em: new Date().toISOString(),
          tem_atualizacao_pos_retorno: check.alerta
        };
        
        results.push(updatedCase);
        if (check.alerta) updatedCount++;
      }
    }

    if (results.length > 0) {
      await saveStoredCases(results);
    }

    return { 
      success: true, 
      scanned: results.length,
      updated: updatedCount,
      message: `Varredura concluída. ${results.length} processos auditados.`
    };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

/**
 * Motor de Recalibração de Prazos v2.0
 */
export async function recalibrateCasesAction(alertLimit: number = 3) {
  try {
    const { auth_id, empresa_id } = await getUserContext();
    if (!empresa_id || !auth_id) return { success: false, error: "Sessão expirada." };
    const cases = await getStoredCases();
    if (!cases || cases.length === 0) return { success: true, count: 0 };
    const updatedCases = cases.map(c => {
      if (isCasoEncerrado(c)) return c;
      return processarCaso({ ...c, statusManual: 'Automatico' }, { alertLimit });
    });
    const chunkSize = 50;
    for (let i = 0; i < updatedCases.length; i += chunkSize) {
      const chunk = updatedCases.slice(i, i + chunkSize);
      const res = await saveStoredCases(chunk);
      if (!res.success) throw new Error(res.message);
    }
    return { success: true, count: updatedCases.length, message: "Todos os prazos foram reprocessados." };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

/**
 * Protocolo de Purga Restrita
 */
export async function deleteAllCasesAction() {
  try {
    const { auth_id, empresa_id } = await getUserContext();
    if (!empresa_id || !auth_id) return { success: false, error: "Sessão expirada." };
    const supabase = await createClient();
    const { error } = await supabase.from('processos').delete().eq('empresa_id', empresa_id).eq('created_by', auth_id);
    if (error) throw error;
    return { success: true, message: "Carteira purgada." };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

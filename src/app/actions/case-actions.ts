'use server';

import { getStoredCasesForEmpresa, saveStoredCasesForEmpresa, getUserContext, getStoredNotes } from '@/lib/server-db';
import { LegalCase, processarCaso } from '@/lib/case-logic';
import { isCasoEncerrado } from '@/lib/status-encerrado';
import { fetchDataJud } from '@/lib/datajud';
import { detectarAtualizacaoPosRetorno } from '@/lib/datajud-sync';

/**
 * @fileOverview Actions de Processos v3.0
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

/**
 * Motor de Varredura DataJud v2.0 ELITE
 * Suporta modo UI (contexto usuário) e modo CRON (targetEmpresaId).
 */
export async function runDataJudScanAction(targetEmpresaId?: string) {
  try {
    let empresa_id: string;
    let isSystemMode = false;

    if (targetEmpresaId) {
      empresa_id = targetEmpresaId;
      isSystemMode = true;
    } else {
      const ctx = await getUserContext();
      if (!ctx.empresa_id) return { success: false, error: "Sessão expirada." };
      empresa_id = ctx.empresa_id;
    }

    // Busca os casos utilizando o cliente adequado (User ou Admin)
    const cases = await getStoredCasesForEmpresa(empresa_id, isSystemMode);
    if (!cases || cases.length === 0) return { success: true, scanned: 0, updated: 0 };

    const activeCases = cases.filter(c => !isCasoEncerrado(c));
    
    // Limite de lote por execução para proteção de infraestrutura
    const batchSize = isSystemMode ? 50 : 20;
    const batch = activeCases.slice(0, batchSize);
    
    let updatedCount = 0;
    const results: LegalCase[] = [];

    for (const c of batch) {
      // Delay de cortesia para a API do CNJ
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
      await saveStoredCasesForEmpresa(results, empresa_id, isSystemMode);
    }

    return { 
      success: true, 
      scanned: results.length,
      updated: updatedCount,
      message: `Varredura concluída. ${results.length} processos auditados para a empresa.`
    };
  } catch (e: any) {
    console.error("[Varredura Action Fail]", e.message);
    return { success: false, error: e.message };
  }
}

/**
 * Motor de Recalibração de Prazos v2.0
 */
export async function recalibrateCasesAction(alertLimit: number = 3) {
  try {
    const { empresa_id } = await getUserContext();
    if (!empresa_id) return { success: false, error: "Sessão expirada." };
    
    const cases = await getStoredCasesForEmpresa(empresa_id);
    if (!cases || cases.length === 0) return { success: true, count: 0 };
    
    const updatedCases = cases.map(c => {
      if (isCasoEncerrado(c)) return c;
      return processarCaso({ ...c, statusManual: 'Automatico' }, { alertLimit });
    });
    
    const res = await saveStoredCasesForEmpresa(updatedCases, empresa_id);
    return { success: true, count: updatedCases.length, message: res.message };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

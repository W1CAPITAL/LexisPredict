
'use server';

import { 
  getStoredCasesForEmpresa, 
  saveStoredCasesForEmpresa, 
  getUserContext, 
  getStoredNotes, 
  getEmpresaUsers 
} from '@/lib/server-db';
import { LegalCase, processarCaso } from '@/lib/case-logic';
import { isCasoEncerrado } from '@/lib/status-encerrado';
import { fetchDataJud } from '@/lib/datajud';
import { detectarAtualizacaoPosRetorno } from '@/lib/datajud-sync';

/**
 * @fileOverview Actions de Processos v90.0 ELITE - Suporte a Scanner Global
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
 * AUDITORIA UNITÁRIA PARA SCANNER GLOBAL
 * Processa um único CNJ e persiste no banco.
 */
export async function scanOneDataJudAction(protocolo: string) {
  try {
    const { empresa_id } = await getUserContext();
    if (!empresa_id) return { success: false, protocolo, error: "Sessão expirada" };

    const cases = await getStoredCasesForEmpresa(empresa_id);
    const target = cases.find(c => c.protocolo === protocolo);
    if (!target) return { success: false, protocolo, error: "Processo não localizado no repositório" };

    const dataJud = await fetchDataJud(protocolo);
    
    if (dataJud && !dataJud.error && dataJud.movimentos) {
      const check = detectarAtualizacaoPosRetorno(target.ultimoRetorno, dataJud.movimentos);
      
      const updatedCase: LegalCase = {
        ...target,
        datajud_ultimo_movimento: check.dataUltimo,
        datajud_ultimo_nome: check.nomeUltimo,
        datajud_consultado_em: new Date().toISOString(),
        tem_atualizacao_pos_retorno: check.alerta,
        tribunal: dataJud.tribunal || target.tribunal
      };
      
      await saveStoredCasesForEmpresa([updatedCase], empresa_id);
      
      return { 
        success: true, 
        protocolo, 
        alerta: check.alerta, 
        nomeUltimo: check.nomeUltimo,
        message: check.alerta ? "Novo andamento!" : "Sem novidades"
      };
    }
    
    return { 
      success: false, 
      protocolo, 
      message: dataJud?.message || "Erro no tribunal",
      error: true 
    };
  } catch (e: any) {
    return { success: false, protocolo, message: "Falha técnica na action", error: true };
  }
}

/**
 * Consulta pontual de um único processo para UI (Modal)
 */
export async function scanSingleCaseAction(protocolo: string) {
  try {
    const { empresa_id } = await getUserContext();
    if (!empresa_id) return { success: false, error: "Sessão expirada." };

    const dataJud = await fetchDataJud(protocolo);
    
    if (dataJud && !dataJud.error) {
      const cases = await getStoredCasesForEmpresa(empresa_id);
      const target = cases.find(c => c.protocolo === protocolo);
      
      if (target) {
        const check = detectarAtualizacaoPosRetorno(target.ultimoRetorno, dataJud.movimentos);
        const updatedCase: LegalCase = {
          ...target,
          datajud_ultimo_movimento: check.dataUltimo,
          datajud_ultimo_nome: check.nomeUltimo,
          datajud_consultado_em: new Date().toISOString(),
          tem_atualizacao_pos_retorno: check.alerta,
          tribunal: dataJud.tribunal || target.tribunal
        };
        
        await saveStoredCasesForEmpresa([updatedCase], empresa_id);
        return { 
          success: true, 
          case: updatedCase, 
          movimentos: dataJud.movimentos,
          message: check.alerta ? "Novo andamento identificado!" : "Sem atualizações após o último retorno."
        };
      }
    }
    
    return { success: false, error: dataJud?.message || "Processo não localizado no DataJud." };
  } catch (e: any) {
    return { success: false, error: "Falha técnica na consulta individual." };
  }
}

/**
 * Motor de Varredura em Lote legado (Mantido para compatibilidade do botão na página)
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

    const cases = await getStoredCasesForEmpresa(empresa_id, isSystemMode);
    if (!cases || cases.length === 0) return { success: true, scanned: 0, updated: 0, message: "Nenhum processo para auditar." };

    const activeCases = cases.filter(c => !isCasoEncerrado(c));
    
    const prioritized = [...activeCases].sort((a, b) => {
      if (!a.datajud_consultado_em && b.datajud_consultado_em) return -1;
      if (a.datajud_consultado_em && !b.datajud_consultado_em) return 1;
      const dateA = a.datajud_consultado_em ? new Date(a.datajud_consultado_em).getTime() : 0;
      const dateB = b.datajud_consultado_em ? new Date(b.datajud_consultado_em).getTime() : 0;
      return dateA - dateB;
    });

    const batch = prioritized.slice(0, 30);
    let updatedCount = 0;
    const results: LegalCase[] = [];

    for (const c of batch) {
      await new Promise(r => setTimeout(r, 400)); 
      try {
        const dataJud = await fetchDataJud(c.protocolo);
        if (dataJud && !dataJud.error && dataJud.movimentos) {
          const check = detectarAtualizacaoPosRetorno(c.ultimoRetorno, dataJud.movimentos);
          results.push({
            ...c,
            datajud_ultimo_movimento: check.dataUltimo,
            datajud_ultimo_nome: check.nomeUltimo,
            datajud_consultado_em: new Date().toISOString(),
            tem_atualizacao_pos_retorno: check.alerta
          });
          if (check.alerta) updatedCount++;
        }
      } catch { continue; }
    }

    if (results.length > 0) {
      await saveStoredCasesForEmpresa(results, empresa_id, isSystemMode);
    }

    return { 
      success: true, 
      scanned: results.length,
      updated: updatedCount,
      message: `Auditados ${results.length}. ${updatedCount} alertas novos.`
    };
  } catch (e: any) {
    return { success: false, error: e.message || "Falha na varredura." };
  }
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

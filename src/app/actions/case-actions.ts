'use server';

import { getStoredCasesForEmpresa, saveStoredCasesForEmpresa, getUserContext, getStoredNotes, getEmpresaUsers } from '@/lib/server-db';
import { LegalCase, processarCaso } from '@/lib/case-logic';
import { isCasoEncerrado } from '@/lib/status-encerrado';
import { fetchDataJud } from '@/lib/datajud';
import { detectarAtualizacaoPosRetorno } from '@/lib/datajud-sync';

/**
 * @fileOverview Actions de Processos v65.0 ELITE - Motor de Varredura Otimizado
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
 * Motor de Performance Global da Empresa
 * Bypassa as restrições de visibilidade individual para compor o ranking.
 * @copyright 2026 Davi Alves Figueredo
 */
export async function fetchTeamPerformanceAction() {
  try {
    const { empresa_id } = await getUserContext();
    if (!empresa_id) return { users: [], cases: [] };

    // Acesso administrativo (isSystemMode = true) apenas para o cálculo de scores da mesma empresa
    const [users, cases] = await Promise.all([
      getEmpresaUsers(),
      getStoredCasesForEmpresa(empresa_id, true)
    ]);

    return { users, cases };
  } catch (error) {
    console.error("[Performance Action Fail]", error);
    return { users: [], cases: [] };
  }
}

/**
 * Consulta pontual de um único processo
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
          // Preservar a classe e tribunal atualizados
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
 * Motor de Varredura em Lote v65.0 ELITE
 * Processa lotes de 30 com priorização inteligente.
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

    // 1. Filtrar ativos
    const activeCases = cases.filter(c => !isCasoEncerrado(c));
    
    // 2. Priorização Inteligente
    const prioritized = [...activeCases].sort((a, b) => {
      if (!a.datajud_consultado_em && b.datajud_consultado_em) return -1;
      if (a.datajud_consultado_em && !b.datajud_consultado_em) return 1;
      if (a.tem_atualizacao_pos_retorno && !b.tem_atualizacao_pos_retorno) return -1;
      if (!a.tem_atualizacao_pos_retorno && b.tem_atualizacao_pos_retorno) return 1;
      
      const dateA = a.datajud_consultado_em ? new Date(a.datajud_consultado_em).getTime() : 0;
      const dateB = b.datajud_consultado_em ? new Date(b.datajud_consultado_em).getTime() : 0;
      return dateA - dateB;
    });

    const batchSize = isSystemMode ? 40 : 30;
    const batch = prioritized.slice(0, batchSize);
    
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
      } catch (innerError) {
        continue;
      }
    }

    if (results.length > 0) {
      await saveStoredCasesForEmpresa(results, empresa_id, isSystemMode);
    }

    return { 
      success: true, 
      scanned: results.length,
      updated: updatedCount,
      total: activeCases.length,
      message: `Auditados ${results.length} de ${activeCases.length} processos ativos. ${updatedCount} novos andamentos identificados.`
    };
  } catch (e: any) {
    return { success: false, error: e.message || "Falha técnica na infraestrutura de varredura." };
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
    if (!cases || cases.length === 0) return { success: true, count: 0, message: "Sem processos para recalibrar." };
    
    const updatedCases = cases.map(c => {
      if (isCasoEncerrado(c)) return c;
      return processarCaso({ ...c, statusManual: 'Automatico' }, { alertLimit });
    });
    
    await saveStoredCasesForEmpresa(updatedCases, empresa_id);
    return { success: true, count: updatedCases.length, message: "Urgências recalculadas com sucesso." };
  } catch (e: any) {
    console.error("[Recalibração Fail]", e.message);
    return { success: false, error: e.message || "Erro ao processar recalibração." };
  }
}

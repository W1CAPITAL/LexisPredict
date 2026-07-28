
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
import { detectarAtualizacaoPosRetorno, detectarEncerradoNoTribunal } from '@/lib/datajud-sync';

/**
 * @fileOverview Actions de Processos v150.0 ELITE - Estabilização de Auditoria Unitária e Scanner
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
 * RECALIBRAGEM DE PRAZOS (MANTIDO CONFORME REQUISITOS)
 */
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

/**
 * BUSCA DE PERFORMANCE PARA RANKING (Bypass RLS)
 */
export async function fetchTeamPerformanceAction() {
  try {
    const { empresa_id } = await getUserContext();
    if (!empresa_id) return { users: [], cases: [] };

    const [users, cases] = await Promise.all([
      getEmpresaUsers(),
      getStoredCasesForEmpresa(empresa_id, true) // true = isAdmin mode (Bypass RLS)
    ]);

    return { users, cases };
  } catch (e: any) {
    console.error("[Performance Action Fail]", e.message);
    return { users: [], cases: [] };
  }
}

/**
 * AUDITORIA UNITÁRIA PARA SCANNER GLOBAL
 * Otimizada para retorno de 'patch' visando performance em lotes.
 */
export async function scanOneDataJudAction(protocolo: string) {
  try {
    const { empresa_id, auth_id } = await getUserContext();
    if (!empresa_id || !auth_id) {
       return { success: false, protocolo, error: "401_SESSAO_EXPIRADA", message: "Sessão expirada — faça login e use RETOMAR" };
    }

    const cases = await getStoredCasesForEmpresa(empresa_id);
    const target = cases.find(c => c.protocolo === protocolo);
    if (!target) return { success: false, protocolo, error: "NOT_FOUND", message: "Processo não localizado" };

    const dataJud = await fetchDataJud(protocolo);
    
    if (dataJud && !dataJud.error && dataJud.movimentos) {
      const check = detectarAtualizacaoPosRetorno(target.ultimoRetorno, dataJud.movimentos);
      const enc = detectarEncerradoNoTribunal(dataJud.movimentos);
      
      const patch = {
        datajud_ultimo_movimento: check.dataUltimo,
        datajud_ultimo_nome: check.nomeUltimo,
        datajud_consultado_em: new Date().toISOString(),
        tem_atualizacao_pos_retorno: check.alerta,
        datajud_encerrado_tribunal: enc.encerrado,
        datajud_encerrado_motivo: enc.motivo,
        tribunal: dataJud.tribunal || target.tribunal
      };

      // Atualizar SOMENTE flags no objeto original
      const updatedCase: LegalCase = { ...target, ...patch };
      
      await saveStoredCasesForEmpresa([updatedCase], empresa_id);
      
      let msg = "Sem novidade";
      let tipo = 'sem_novidade';
      if (enc.encerrado) {
        msg = `ENCERRADO NO TRIBUNAL — ${enc.motivo}`;
        tipo = 'encerrado';
      } else if (check.alerta) {
        msg = `NOVO ANDAMENTO — ${check.nomeUltimo}`;
        tipo = 'novo_andamento';
      }
      
      return { 
        success: true, 
        protocolo, 
        tipo,
        alerta: check.alerta, 
        encerrado: enc.encerrado,
        motivo: enc.motivo,
        message: msg,
        casePatch: patch
      };
    }
    
    return { 
      success: false, 
      protocolo, 
      tipo: 'erro',
      message: `Falha — ${dataJud?.message || "Erro no tribunal"}`,
      error: true 
    };
  } catch (e: any) {
    const isAuthError = e.message?.includes('400') || e.message?.includes('401') || e.message?.includes('refresh_token');
    return { 
      success: false, 
      protocolo, 
      tipo: 'erro', 
      message: isAuthError ? "Sessão expirada — faça login e use RETOMAR" : `Falha técnica`,
      error: true,
      isAuthError
    };
  }
}

/**
 * CONSULTA PONTUAL E DETALHADA (Para Modal de Histórico)
 * Retorna o objeto do caso completo e a lista de movimentos.
 */
export async function scanSingleCaseAction(protocolo: string) {
  try {
    const { empresa_id, auth_id } = await getUserContext();
    if (!empresa_id || !auth_id) {
       return { success: false, error: "401_SESSAO_EXPIRADA", message: "Sessão expirada — faça login." };
    }

    const cases = await getStoredCasesForEmpresa(empresa_id);
    const target = cases.find(c => c.protocolo === protocolo);
    if (!target) return { success: false, error: "NOT_FOUND", message: "Processo não localizado no repositório." };

    const dataJud = await fetchDataJud(protocolo);
    
    if (dataJud && !dataJud.error && dataJud.movimentos) {
      const check = detectarAtualizacaoPosRetorno(target.ultimoRetorno, dataJud.movimentos);
      const enc = detectarEncerradoNoTribunal(dataJud.movimentos);
      
      const patch = {
        datajud_ultimo_movimento: check.dataUltimo,
        datajud_ultimo_nome: check.nomeUltimo,
        datajud_consultado_em: new Date().toISOString(),
        tem_atualizacao_pos_retorno: check.alerta,
        datajud_encerrado_tribunal: enc.encerrado,
        datajud_encerrado_motivo: enc.motivo,
        tribunal: dataJud.tribunal || target.tribunal
      };

      const updatedCase: LegalCase = { ...target, ...patch };
      await saveStoredCasesForEmpresa([updatedCase], empresa_id);
      
      let msg = "Auditoria concluída: Sem novidades.";
      if (enc.encerrado) msg = `IDENTIFICADO ENCERRAMENTO: ${enc.motivo}`;
      else if (check.alerta) msg = "ALERTA: Novo andamento identificado no tribunal!";
      
      return { 
        success: true, 
        case: updatedCase, 
        movimentos: dataJud.movimentos,
        casePatch: patch, // Retrocompatibilidade para hooks reativos
        message: msg
      };
    }
    
    return { 
      success: false, 
      error: "TRIBUNAL_OFFLINE", 
      message: dataJud?.message || "O tribunal não retornou dados para este CNJ." 
    };
  } catch (e: any) {
    return { success: false, error: "ERRO_TECNICO", message: e.message || "Falha na comunicação forense." };
  }
}

/**
 * Motor de Varredura em Lote (Cron / Legado)
 */
export async function runDataJudScanAction(targetEmpresaId?: string) {
  try {
    let empresa_id: string;
    if (targetEmpresaId) {
      empresa_id = targetEmpresaId;
    } else {
      const ctx = await getUserContext();
      if (!ctx.empresa_id) return { success: false, error: "Sessão expirada." };
      empresa_id = ctx.empresa_id;
    }

    const cases = await getStoredCasesForEmpresa(empresa_id);
    if (!cases || cases.length === 0) return { success: true, scanned: 0, updated: 0, message: "Nenhum processo." };

    const batch = cases.filter(c => !isCasoEncerrado(c)).slice(0, 30);
    let updatedCount = 0;

    for (const c of batch) {
      await scanOneDataJudAction(c.protocolo);
      updatedCount++;
    }

    return { 
      success: true, 
      scanned: batch.length,
      updated: updatedCount,
      message: `Auditados ${batch.length} registros.`
    };
  } catch (e: any) {
    return { success: false, error: "Falha na varredura." };
  }
}

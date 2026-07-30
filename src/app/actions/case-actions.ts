
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
import { analisarBuscaApreensao } from '@/lib/busca-apreensao';

/**
 * @fileOverview Actions de Processos v210.0 ELITE - Sincronia com Telemetria e Retries
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

export async function scanOneDataJudAction(protocolo: string, noRetry = false) {
  try {
    const { empresa_id, auth_id } = await getUserContext();
    if (!empresa_id || !auth_id) {
       return { success: false, protocolo, error: "401_SESSAO_EXPIRADA", message: "Sessão expirada" };
    }

    const cases = await getStoredCasesForEmpresa(empresa_id);
    const target = cases.find(c => c.protocolo === protocolo);
    if (!target) return { success: false, protocolo, error: "NOT_FOUND", message: "Processo não localizado" };

    const dataJud = await fetchDataJud(protocolo, 1, noRetry);
    const attempts = dataJud?.attempts || 1;
    
    if (dataJud && !dataJud.error && dataJud.movimentos) {
      const check = detectarAtualizacaoPosRetorno(target.ultimoRetorno, dataJud.movimentos);
      const enc = detectarEncerradoNoTribunal(dataJud.movimentos);
      const ba = analisarBuscaApreensao(dataJud);
      
      const patch = {
        datajud_ultimo_movimento: check.dataUltimo,
        datajud_ultimo_nome: check.nomeUltimo,
        datajud_consultado_em: new Date().toISOString(),
        tem_atualizacao_pos_retorno: !!check.alerta,
        datajud_encerrado_tribunal: !!enc.encerrado,
        datajud_encerrado_motivo: enc.motivo,
        indicio_busca_apreensao: !!ba.indicio,
        busca_apreensao_confianca: ba.confianca,
        busca_apreensao_motivo: ba.motivo,
        busca_apreensao_consultado_em: ba.indicio ? new Date().toISOString() : null,
        tribunal: dataJud.tribunal || target.tribunal
      };

      // REGRA DE SOBRESCRITA INTELIGENTE: Só salva se houver mudança real ou para atualizar o timestamp de consulta
      // O timestamp atualizado é vital para o filtro de "Retomar" não repetir o mesmo processo.
      const hasRealChange = 
        patch.datajud_ultimo_nome !== target.datajud_ultimo_nome ||
        patch.datajud_encerrado_tribunal !== !!target.datajud_encerrado_tribunal ||
        patch.indicio_busca_apreensao !== !!target.indicio_busca_apreensao ||
        patch.tem_atualizacao_pos_retorno !== !!target.tem_atualizacao_pos_retorno;

      const updatedCase: LegalCase = { ...target, ...patch };
      await saveStoredCasesForEmpresa([updatedCase], empresa_id);
      
      let msg = attempts > 1 ? `Auditado (Recuperado na T${attempts})` : "Auditado";
      if (!hasRealChange) msg += " (Sem mudanças)";
      
      let tipo = 'sem_novidade';
      
      if (enc.encerrado) {
        msg = `ENCERRADO NO TRIBUNAL — ${enc.motivo}${attempts > 1 ? ` (T${attempts})` : ''}`;
        tipo = 'encerrado';
      } else if (ba.indicio && ba.confianca === 'alta') {
        msg = `⚠ ALERTA BUSCA E APREENSÃO DETECTADA${attempts > 1 ? ` (T${attempts})` : ''}`;
        tipo = 'novo_andamento';
      } else if (check.alerta) {
        msg = `NOVO ANDAMENTO — ${check.nomeUltimo}${attempts > 1 ? ` (T${attempts})` : ''}`;
        tipo = 'novo_andamento';
      }
      
      return { 
        success: true, 
        protocolo, 
        tipo,
        alerta: !!(check.alerta || ba.indicio), 
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
  try {
    const { empresa_id, auth_id } = await getUserContext();
    if (!empresa_id || !auth_id) return { success: false, error: "401_SESSAO_EXPIRADA", message: "Sessão expirada." };

    const cases = await getStoredCasesForEmpresa(empresa_id);
    const target = cases.find(c => c.protocolo === protocolo);
    if (!target) return { success: false, error: "NOT_FOUND", message: "Não localizado." };

    const dataJud = await fetchDataJud(protocolo);
    
    if (dataJud && !dataJud.error && dataJud.movimentos) {
      const check = detectarAtualizacaoPosRetorno(target.ultimoRetorno, dataJud.movimentos);
      const enc = detectarEncerradoNoTribunal(dataJud.movimentos);
      const ba = analisarBuscaApreensao(dataJud);
      
      const patch = {
        datajud_ultimo_movimento: check.dataUltimo,
        datajud_ultimo_nome: check.nomeUltimo,
        datajud_consultado_em: new Date().toISOString(),
        tem_atualizacao_pos_retorno: !!check.alerta,
        datajud_encerrado_tribunal: !!enc.encerrado,
        datajud_encerrado_motivo: enc.motivo,
        indicio_busca_apreensao: !!ba.indicio,
        busca_apreensao_confianca: ba.confianca,
        busca_apreensao_motivo: ba.motivo,
        busca_apreensao_consultado_em: ba.indicio ? new Date().toISOString() : null,
        tribunal: dataJud.tribunal || target.tribunal
      };

      const updatedCase: LegalCase = { ...target, ...patch };
      await saveStoredCasesForEmpresa([updatedCase], empresa_id);
      
      let msg = "Sem atualizações após o último retorno.";
      if (enc.encerrado) {
        msg = `ENCERRADO NO TRIBUNAL — ${enc.motivo}`;
      } else if (check.alerta) {
        msg = "Novo andamento identificado!";
      } else if (ba.indicio) {
        msg = `ALERTA: Indício de Busca e Apreensão (${ba.confianca})`;
      }
      
      return { 
        success: true, 
        case: updatedCase, 
        movimentos: dataJud.movimentos || [], 
        casePatch: patch, 
        message: msg 
      };
    }
    return { success: false, error: "TRIBUNAL_OFFLINE", message: dataJud?.message || "Sem dados." };
  } catch (e: any) {
    return { success: false, error: "ERRO_TECNICO", message: e.message };
  }
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
      await scanOneDataJudAction(c.protocolo);
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

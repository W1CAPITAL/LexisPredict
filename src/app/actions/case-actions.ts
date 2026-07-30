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
import { ScannerService } from '@/modules/process-scanner/services/scanner-service';

/**
 * @fileOverview Actions de Processos v530.0 ELITE - Unificação Híbrida Compulsória
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
 * Unificação Suprema: O Scanner de Painel agora usa o Motor Híbrido Consolidador.
 */
export async function scanOneDataJudAction(protocolo: string, fast = true) {
  try {
    const { empresa_id, auth_id } = await getUserContext();
    if (!empresa_id || !auth_id) {
       return { success: false, protocolo, error: "401_UNAUTHORIZED", message: "Sessão expirada" };
    }

    const supabase = await createClient();
    if (!supabase) throw new Error("Supabase indisponível.");

    // Obter hash anterior para detecção de mudança
    const { data: currentScan } = await supabase
      .from('process_scans')
      .select('metadata')
      .eq('cnj', protocolo)
      .maybeSingle();

    const lastHash = (currentScan?.metadata as any)?.hash || null;

    // Executar Auditoria Híbrida Unificada
    const scanner = new ScannerService();
    const result = await scanner.auditarProcesso(protocolo, lastHash);

    if (result.localizado) {
      // 1. Atualizar Tabela de Auditoria (Dashboard Inteligente)
      await supabase.from('process_scans').upsert({
        empresa_id: empresa_id,
        cnj: result.cnj,
        status: result.statusAuditoria,
        last_sync: result.dataAuditoria,
        metadata: {
          ultimo_evento: result.analysis.detalhes,
          data_evento: result.dataUltimoEvento,
          categoria: result.analysis.categoria,
          criticidade: result.analysis.criticidade,
          confianca: result.analysis.confianca,
          dias_parado: result.diasSemMovimentacao,
          mudanca_detectada: result.mudancaDetectada,
          hash: result.hash,
          tribunal: result.tribunal,
          classe: result.metadata.classe,
          orgao: result.metadata.orgao,
          source: result.debug.source
        }
      }, { onConflict: 'cnj' });

      // 2. Atualizar Tabela Principal (Vigilância Passiva)
      if (result.mudancaDetectada || result.analysis.categoria === 'Possível encerramento') {
        await supabase.from('processos').update({
           tem_atualizacao_pos_retorno: true,
           datajud_ultimo_nome: result.analysis.detalhes,
           datajud_ultimo_movimento: result.dataUltimoEvento,
           datajud_consultado_em: result.dataAuditoria,
           datajud_encerrado_tribunal: result.analysis.categoria === 'Possível encerramento'
        }).eq('protocolo_ref', protocolo).eq('empresa_id', empresa_id);
      } else {
        await supabase.from('processos').update({
           datajud_consultado_em: result.dataAuditoria
        }).eq('protocolo_ref', protocolo).eq('empresa_id', empresa_id);
      }
    }

    return { 
      success: result.localizado, 
      protocolo, 
      message: result.statusAuditoria,
      casePatch: { datajud_consultado_em: result.dataAuditoria },
      latency: result.debug.latency,
      httpStatus: result.debug.httpStatus,
      attempts: 1 
    };

  } catch (e: any) {
    return { success: false, protocolo, error: "ERR_INFRA", message: e.message };
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
    const supabase = await createClient();
    // Limpar tabela de auditoria
    await supabase.from('process_scans').delete().eq('empresa_id', empresa_id);
    // Limpar flags na tabela principal
    await supabase.from('processos').update({
      tem_atualizacao_pos_retorno: false,
      datajud_encerrado_tribunal: false,
      datajud_encerrado_motivo: null,
      datajud_consultado_em: null,
      datajud_ultimo_movimento: null,
      datajud_ultimo_nome: null,
      indicio_busca_apreensao: false
    }).eq('empresa_id', empresa_id);
    return { success: true };
  } catch (e) {
    return { success: false };
  }
}

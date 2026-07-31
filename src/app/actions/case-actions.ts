'use server';

/**
 * @copyright 2026 Davi Alves Figueredo / W1 Capital Assessoria Financeira Ltda.
 * @license Proprietary - All rights reserved.
 * REPOSITÓRIO DE AÇÕES DE GABINETE v462.0 ELITE
 */

import { 
  getStoredCasesForEmpresa, 
  saveStoredCasesForEmpresa, 
  getUserContext, 
  getStoredNotes, 
  getEmpresaUsers,
  updateCaseDataJudSystem
} from '@/lib/server-db';
import { createClient } from '@/lib/supabase/server';
import { LegalCase, processarCaso } from '@/lib/case-logic';
import { isCasoEncerrado } from '@/lib/status-encerrado';
import { fetchDataJud } from '@/lib/datajud';
import { detectarAtualizacaoPosRetorno, detectarEncerradoNoTribunal, gerarHashAuditoria, detectarCumprimentoSentenca } from '@/lib/datajud-sync';
import { analisarBuscaApreensao } from '@/lib/busca-apreensao';
import { fetchDjenComunicacoes } from '@/lib/djen';
import { detectarNovaComunicacaoDjen } from '@/lib/djen-sync';
import { headers } from 'next/headers';

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
 * Realiza a auditoria de um único protocolo via DataJud.
 * Sempre persiste o patch de telemetria completo (soberania do dado atual).
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
      ultimoRetorno: dbItem.ultimo_retorno || '',
      datajud_hash: dbItem.datajud_hash
    });

    // Se já está encerrado internamente, não gasta banda de API pública
    if (isCasoEncerrado(target)) {
      return { success: true, protocolo, message: "Já encerrado internamente", skipped: true };
    }

    const dataJud = await fetchDataJud(protocolo, 1, { fast });
    
    if (dataJud && !dataJud.error) {
      const movimentos = Array.isArray(dataJud.movimentos) ? dataJud.movimentos : [];
      const check = detectarAtualizacaoPosRetorno(target.ultimoRetorno, movimentos);
      const enc = detectarEncerradoNoTribunal(movimentos);
      const ba = analisarBuscaApreensao(dataJud);
      const cump = detectarCumprimentoSentenca(movimentos);
      const newHash = gerarHashAuditoria(movimentos);
      
      const patch = {
        datajud_ultimo_movimento: check.dataUltimo,
        datajud_ultimo_nome: check.nomeUltimo,
        datajud_consultado_em: new Date().toISOString(),
        tem_atualizacao_pos_retorno: !!check.alerta, 
        datajud_encerrado_tribunal: !!enc.encerrado,
        datajud_encerrado_motivo: enc.motivo,
        datajud_hash: newHash,
        indicio_busca_apreensao: !!ba.indicio,
        busca_apreensao_confianca: ba.confianca,
        busca_apreensao_motivo: ba.motivo,
        busca_apreensao_consultado_em: ba.indicio ? new Date().toISOString() : null,
        em_cumprimento_sentenca: !enc.encerrado && cump.ativo,
        cumprimento_sentenca_motivo: !enc.encerrado ? cump.motivo : null,
        cumprimento_sentenca_consultado_em: new Date().toISOString(),
        tribunal: dataJud.tribunal || target.tribunal
      };

      // Persistência Integral do Patch auditado
      await updateCaseDataJudSystem(dbItem.id, patch);
      
      return { 
        success: true, 
        protocolo, 
        casePatch: patch,
        movimentos,
        case: { ...target, ...patch }
      };
    }
    
    const failMsg = dataJud?.message || "Erro no tribunal";
    return { success: false, protocolo, message: failMsg, error: true };
  } catch (e: any) {
    return { success: false, protocolo, message: `Falha técnica`, error: true };
  }
}

export async function scanSingleCaseAction(protocolo: string) {
  return await scanOneDataJudAction(protocolo, false);
}

/**
 * Realiza a auditoria DJEN (Diário Nacional) de um único protocolo.
 * Pesquisa no último ano e grava flags djen_*.
 */
export async function scanOneDjenAction(protocolo: string, opts?: { dataInicio?: string; dataFim?: string }) {
  try {
    const { empresa_id, auth_id } = await getUserContext();
    if (!empresa_id || !auth_id) {
      return { success: false, message: "Sessão expirada." };
    }

    const supabase = await createClient();
    const { data: dbItem } = await supabase
      .from('processos')
      .select('*')
      .eq('protocolo_ref', protocolo)
      .eq('empresa_id', empresa_id)
      .maybeSingle();

    if (!dbItem) return { success: false, message: "Processo não localizado." };

    const sigla = dbItem.tribunal && dbItem.tribunal.length >= 2 && !/^outros$/i.test(dbItem.tribunal) 
      ? dbItem.tribunal 
      : undefined;

    const data = await fetchDjenComunicacoes(protocolo, {
      siglaTribunal: sigla,
      dataInicio: opts?.dataInicio,
      dataFim: opts?.dataFim
    });

    if (data.isRateLimited) {
      return { success: false, isRateLimited: true, message: data.error || "Rate limit DJEN — aguarde 1 minuto." };
    }
    if (!data.success) {
      return { success: false, message: data.error || "Falha na comunicação DJEN" };
    }

    const check = detectarNovaComunicacaoDjen(dbItem.ultimo_retorno, data.items);
    
    const patch = {
      djen_consultado_em: new Date().toISOString(),
      djen_nova_comunicacao: !!check.alerta,
      djen_ultima_data: check.dataUltima,
      djen_ultimo_resumo: check.resumo,
      djen_ultimo_link: check.link,
      djen_count: data.count
    };

    await updateCaseDataJudSystem(dbItem.id, patch);

    return { 
      success: true, 
      protocolo, 
      casePatch: patch, 
      comunicacoes: data.items, 
      message: check.alerta ? "Nova comunicação no DJEN" : (data.count ? `Comunicações DJEN: ${data.count}` : "Nenhuma comunicação no DJEN")
    };
  } catch (e: any) {
    return { success: false, message: e?.message || "Falha técnica na consulta DJEN." };
  }
}

export async function runDataJudScanAction(targetEmpresaId?: string) {
  try {
    const ctx = await getUserContext();
    const empresa_id = targetEmpresaId || ctx.empresa_id;
    if (!empresa_id) return { success: false, error: "Sessão expirada." };

    const cases = await getStoredCasesForEmpresa(empresa_id);
    if (!cases || cases.length === 0) return { success: true, scanned: 0, updated: 0, message: "Nenhum processo." };

    // Lote de 30 para evitar gateway timeout em execuções manuais
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
      busca_apreensao_consultado_em: null,
      em_cumprimento_sentenca: false,
      cumprimento_sentenca_motivo: null,
      cumprimento_sentenca_consultado_em: null,
      djen_nova_comunicacao: false
    }));
    await saveStoredCasesForEmpresa(updated, empresa_id);
    return { success: true };
  } catch (e) {
    return { success: false };
  }
}

export async function runCloudWorkerAction() {
  try {
    const { empresa_id } = await getUserContext();
    if (!empresa_id) throw new Error("Sessão expirada.");

    const secret = process.env.DATAJUD_WORKER_SECRET;
    if (!secret) throw new Error("DATAJUD_WORKER_SECRET ausente.");

    const h = await headers();
    const host = h.get('host');
    const protocol = host?.includes('localhost') ? 'http' : 'https';
    const baseUrl = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : `${protocol}://${host}`;

    // Disparo Fire-and-Forget
    fetch(`${baseUrl}/api/datajud-worker?empresa_id=${empresa_id}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${secret}`,
        'Content-Type': 'application/json'
      },
      cache: 'no-store',
      signal: AbortSignal.timeout(8000)
    }).catch(() => {});

    return { success: true, message: "Lote disparado no servidor." };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

'use server';

/**
 * @copyright 2026 Davi Alves Figueredo / W1 Capital Assessoria Financeira Ltda.
 * @license Proprietary - All rights reserved.
 * REPOSITÓRIO DE AÇÕES DE GABINETE v550.0 ELITE - PERSISTÊNCIA HÍBRIDA UNIFICADA
 */

import { 
  getStoredCasesForEmpresa, 
  saveStoredCasesForEmpresa, 
  getUserContext, 
  updateCaseDataJudSystem
} from '@/lib/server-db';
import { createClient } from '@/lib/supabase/server';
import { LegalCase, processarCaso, EventoTipo } from '@/lib/case-logic';
import { isCasoEncerrado } from '@/lib/status-encerrado';
import { fetchDataJud } from '@/lib/datajud';
import { detectarAtualizacaoPosRetorno, detectarEncerradoNoTribunal, detectarCumprimentoSentenca } from '@/lib/datajud-sync';
import { analisarBuscaApreensao } from '@/lib/busca-apreensao';
import { fetchDjenComunicacoes, classifyEventFromText, summarizeDjenKeywords } from '@/lib/djen';
import { detectarNovaComunicacaoDjen } from '@/lib/djen-sync';

export async function fetchRepoCases() {
  const { empresa_id } = await getUserContext();
  if (!empresa_id) return [];
  return await getStoredCasesForEmpresa(empresa_id);
}

export async function syncRepoCases(cases: LegalCase[]) {
  const { empresa_id } = await getUserContext();
  if (!empresa_id) return { success: false, message: "Sessão expirada." };
  return await saveStoredCasesForEmpresa(cases, empresa_id);
}

/**
 * Wrapper para execução em lote via Cron ou Sistema.
 */
export async function runDataJudScanAction(empresaId: string) {
  try {
    const cases = await getStoredCasesForEmpresa(empresaId, true);
    const activeCases = cases.filter(c => !isCasoEncerrado(c));
    let updated = 0;

    // Executa scan atômico para os 20 mais prioritários para evitar timeout do cron
    const targetCases = activeCases.slice(0, 20);

    for (const c of targetCases) {
      const res = await scanOneDataJudAction(c.protocolo, { fast: true });
      if (res.success && (res.casePatch?.tem_atualizacao_pos_retorno || res.casePatch?.djen_nova_comunicacao)) {
        updated++;
      }
    }

    return { success: true, scanned: targetCases.length, updated };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

/**
 * Auditoria Atômica Independente (Híbrida)
 */
export async function scanOneDataJudAction(protocolo: string, options: { fast?: boolean } = {}) {
  try {
    const { empresa_id } = await getUserContext();
    if (!empresa_id) return { success: false, error: "401" };

    const supabase = await createClient();
    const { data: dbItem } = await supabase.from('processos').select('*').eq('protocolo_ref', protocolo).eq('empresa_id', empresa_id).maybeSingle();
    if (!dbItem) return { success: false, error: "NOT_FOUND" };

    const target = processarCaso({ ...(dbItem.dados as any), id: dbItem.id.toString(), ultimoRetorno: dbItem.ultimo_retorno });
    if (isCasoEncerrado(target)) return { success: true, skipped: true };

    const fast = !!options.fast;

    // 1. Execução Paralela (Tribunal + Diário)
    const [dataJud, djenRes] = await Promise.all([
      fetchDataJud(protocolo, 1, { fast }),
      fetchDjenComunicacoes(protocolo)
    ]);

    const patch: any = {
      datajud_consultado_em: new Date().toISOString(),
      djen_consultado_em: new Date().toISOString()
    };

    let hasSuccess = false;
    let eventResumo: string | null = null;
    let eventTipo: EventoTipo = 'rotina';

    // 2. Processamento DataJud
    if (dataJud && !dataJud.error) {
      const movimentos = dataJud.movimentos || [];
      const upd = detectarAtualizacaoPosRetorno(target.ultimoRetorno, movimentos);
      const enc = detectarEncerradoNoTribunal(movimentos);
      const ba = analisarBuscaApreensao(dataJud);
      const cump = detectarCumprimentoSentenca(movimentos);

      Object.assign(patch, {
        datajud_ultimo_movimento: upd.dataUltimo,
        datajud_ultimo_nome: upd.nomeUltimo,
        tem_atualizacao_pos_retorno: upd.alerta,
        datajud_encerrado_tribunal: enc.encerrado,
        datajud_encerrado_motivo: enc.motivo,
        indicio_busca_apreensao: ba.indicio,
        busca_apreensao_confianca: ba.confianca,
        busca_apreensao_motivo: ba.motivo,
        em_cumprimento_sentenca: cump.ativo
      });

      if (upd.alerta) {
        eventResumo = upd.nomeUltimo;
        eventTipo = 'novo_andamento_relevante';
      }
      if (ba.indicio) eventTipo = 'ba';
      if (enc.encerrado) eventTipo = 'transito_ou_baixa';
      
      hasSuccess = true;
    }

    // 3. Processamento DJEN
    if (djenRes.success) {
      const djenSync = detectarNovaComunicacaoDjen(target.ultimoRetorno, djenRes.items);
      
      Object.assign(patch, {
        djen_nova_comunicacao: djenSync.alerta,
        djen_ultima_data: djenSync.dataUltima,
        djen_ultimo_resumo: djenSync.resumo,
        djen_ultimo_link: djenSync.link,
        djen_count: djenRes.count
      });

      if (djenSync.alerta) {
        const djenClass = classifyEventFromText(djenRes.items[0]?.texto);
        // DJEN sobrepõe DataJud se for um evento de mérito
        if (djenClass.tipo !== 'rotina') {
           eventTipo = djenClass.tipo;
           eventResumo = djenSync.resumo;
        } else if (!eventResumo) {
           eventResumo = djenSync.resumo;
        }
      }
      hasSuccess = true;
    }

    if (hasSuccess) {
      patch.evento_tipo = eventTipo;
      patch.evento_resumo = eventResumo;
      patch.evento_fonte = (patch.tem_atualizacao_pos_retorno && patch.djen_nova_comunicacao) ? 'ambos' : patch.tem_atualizacao_pos_retorno ? 'datajud' : 'djen';

      await updateCaseDataJudSystem(dbItem.id, patch);
      const updatedCase = processarCaso({ ...target, ...patch });
      return { 
        success: true, 
        casePatch: patch, 
        movimentos: dataJud?.movimentos || [], 
        comunicacoes: djenRes.items || [],
        case: updatedCase 
      };
    }
    
    return { success: false, message: dataJud?.message || djenRes.error || "Erro de conexão com os tribunais" };
  } catch (e: any) {
    return { success: false, message: `Falha na auditoria técnica: ${e.message}` };
  }
}

export async function scanOneDjenAction(protocolo: string) {
  return await scanOneDataJudAction(protocolo, { fast: true });
}

export async function scanSingleCaseAction(protocolo: string) {
  return await scanOneDataJudAction(protocolo, { fast: false });
}

export async function recalibrateCasesAction(alertLimit: number) {
  try {
    const { empresa_id } = await getUserContext();
    if (!empresa_id) return { success: false };
    const cases = await getStoredCasesForEmpresa(empresa_id, true);
    const updated = cases.map(c => processarCaso(c, { alertLimit }));
    await saveStoredCasesForEmpresa(updated, empresa_id, true);
    return { success: true, message: `${updated.length} registros recalibrados.` };
  } catch (e) {
    return { success: false };
  }
}

export async function fetchRepoNotes() {
  const { getStoredNotes } = await import('@/lib/server-db');
  return await getStoredNotes();
}

export async function fetchTeamPerformanceAction() {
  const { getEmpresaUsers, getStoredCasesForEmpresa, getUserContext } = await import('@/lib/server-db');
  const { empresa_id } = await getUserContext();
  if (!empresa_id) return { users: [], cases: [] };
  const [users, cases] = await Promise.all([
    getEmpresaUsers(),
    getStoredCasesForEmpresa(empresa_id, true)
  ]);
  return { users, cases };
}
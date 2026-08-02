'use server';
/**
 * @copyright 2026 Davi Alves Figueredo / W1 Capital Assessoria Financeira Ltda.
 * @license Proprietary - All rights reserved.
 * REPOSITÓRIO DE AÇÕES DE GABINETE v700.0 ELITE - NÚCLEO SYSTEM UNIFICADO
 */
import {
  getStoredCasesForEmpresa,
  saveStoredCasesForEmpresa,
  getUserContext,
  updateCaseDataJudSystem,
  getSupabaseAdmin
} from '@/lib/server-db';
import { LegalCase, processarCaso, EventoTipo } from '@/lib/case-logic';
import { isCasoEncerrado } from '@/lib/status-encerrado';
import { fetchDataJud } from '@/lib/datajud';
import { detectarAtualizacaoPosRetorno, detectarEncerradoNoTribunal, detectarCumprimentoSentenca } from '@/lib/datajud-sync';
import { analisarBuscaApreensao } from '@/lib/busca-apreensao';
import { fetchDjenComunicacoes, classifyEventFromText, summarizeDjenKeywords } from '@/lib/djen';
import { detectarNovaComunicacaoDjen } from '@/lib/djen-sync';
import { isAfter, parse, isValid, parseISO } from 'date-fns';

/**
 * Helper para validar se uma data de evento ainda é posterior ao retorno humano.
 * Essencial para manter flags de novidade ativas até o atendimento.
 */
function movimentoAindaPosRetorno(dataEventoStr: string | null | undefined, ultimoRetornoStr: string | null | undefined): boolean {
  if (!dataEventoStr) return false;
  if (!ultimoRetornoStr || !String(ultimoRetornoStr).trim() || ultimoRetornoStr === '-' || ultimoRetornoStr === '0') return true;
  
  try {
    const dataEvento = parseISO(dataEventoStr);
    if (!isValid(dataEvento)) return true;
    
    const cleanStr = String(ultimoRetornoStr).trim();
    let dataRetorno: Date | undefined;
    
    if (cleanStr.includes('-') && cleanStr.length >= 10) {
      dataRetorno = parseISO(cleanStr.slice(0, 10));
    } else if (cleanStr.includes('/')) {
      dataRetorno = parse(cleanStr, 'dd/MM/yyyy', new Date());
    }
    
    if (dataRetorno && isValid(dataRetorno)) {
      const fimDoDiaRetorno = new Date(dataRetorno);
      fimDoDiaRetorno.setHours(23, 59, 59, 999);
      return isAfter(dataEvento, fimDoDiaRetorno);
    }
    return true;
  } catch {
    return true;
  }
}

/**
 * Pesos de Importância Jurídica para seleção de Capa.
 */
function getWeight(t: string | null | undefined): number {
  if (!t) return 0;
  const weights: Record<string, number> = {
    'ba': 100,
    'transito_ou_baixa': 90, 
    'transito_baixa': 90,
    'sentenca_procedente': 85, 
    'sentenca_improcedente': 85, 
    'sentenca_parcial': 84, 
    'liminar': 83,
    'audiencia_julgamento': 80, 
    'audiencia_instrucao': 79, 
    'audiencia_conciliacao': 78,
    'cancelamento_distribuicao': 75,
    'cumprimento_sentenca': 70,
    'novo_andamento_relevante': 50,
    'rotina': 10
  };
  return weights[t] || 0;
}

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
 * NÚCLEO SOBERANO DE AUDITORIA (SYSTEM MODE)
 * Unifica Tribunal + Diário e garante persistência idempotente de flags.
 */
export async function auditCaseCoreSystem(
  protocolo: string, 
  empresaId: string, 
  mode: 'datajud' | 'djen' | 'both' = 'both', 
  options: { fast?: boolean } = {}
) {
  const admin = await getSupabaseAdmin();
  const { data: dbItem } = await admin
    .from('processos')
    .select('*')
    .eq('protocolo_ref', protocolo)
    .eq('empresa_id', empresaId)
    .maybeSingle();

  if (!dbItem) return { success: false, error: "NOT_FOUND" };

  const target = processarCaso({ 
    ...(dbItem.dados as any), 
    id: dbItem.id.toString(), 
    ultimoRetorno: dbItem.ultimo_retorno 
  });

  // Se o caso já foi encerrado no gabinete, não há necessidade de novos alertas de mérito
  if (isCasoEncerrado(target)) return { success: true, skipped: true, case: target, casePatch: {}, movimentos: [], comunicacoes: [] };

  const patch: Record<string, any> = {};
  let movimentos: any[] = [];
  let comunicacoes: any[] = [];
  
  let eventTipo: EventoTipo = (target.evento_tipo as EventoTipo) || 'rotina';
  let eventResumo: string | null = target.evento_resumo || null;

  let datajudOk = false;
  let djenOk = false;

  // --- BLOCO DATAJUD ---
  if (mode === 'datajud' || mode === 'both') {
    try {
      const dataJud = await fetchDataJud(protocolo, 1, options);
      if (dataJud && !dataJud.error) {
        datajudOk = true;
        movimentos = dataJud.movimentos || [];
        const upd = detectarAtualizacaoPosRetorno(target.ultimoRetorno, movimentos);
        const enc = detectarEncerradoNoTribunal(movimentos);
        const ba = analisarBuscaApreensao(dataJud);
        const cump = detectarCumprimentoSentenca(movimentos);

        const dataMovRef = upd.dataUltimo || target.datajud_ultimo_movimento || null;
        
        // Idempotência: Se já tinha alerta e a data continua sendo posterior ao retorno, mantém.
        patch.tem_atualizacao_pos_retorno = upd.alerta === true || 
          (!!target.tem_atualizacao_pos_retorno && movimentoAindaPosRetorno(dataMovRef, target.ultimoRetorno));

        Object.assign(patch, {
          datajud_ultimo_movimento: upd.dataUltimo || target.datajud_ultimo_movimento || null,
          datajud_ultimo_nome: upd.nomeUltimo || target.datajud_ultimo_nome || null,
          datajud_encerrado_tribunal: !!(enc.encerrado || target.datajud_encerrado_tribunal),
          datajud_encerrado_motivo: enc.motivo || target.datajud_encerrado_motivo || null,
          indicio_busca_apreensao: !!(ba.indicio || target.indicio_busca_apreensao),
          busca_apreensao_confianca: ba.confianca ?? target.busca_apreensao_confianca ?? null,
          busca_apreensao_motivo: ba.motivo || target.busca_apreensao_motivo || null,
          em_cumprimento_sentenca: !!(cump.ativo || target.em_cumprimento_sentenca),
          datajud_consultado_em: new Date().toISOString(),
          tribunal: dataJud.tribunal || target.tribunal
        });

        // Hierarquia de Mérito DataJud
        if (ba.indicio && getWeight('ba') >= getWeight(eventTipo)) {
          eventTipo = 'ba';
          eventResumo = ba.motivo || eventResumo;
        } else if (enc.encerrado && getWeight('transito_ou_baixa') >= getWeight(eventTipo)) {
          eventTipo = 'transito_ou_baixa';
          eventResumo = enc.motivo || eventResumo;
        } else if (cump.ativo && getWeight('cumprimento_sentenca') >= getWeight(eventTipo)) {
          eventTipo = 'cumprimento_sentenca';
          eventResumo = cump.motivo || eventResumo;
        } else if (upd.alerta && getWeight('novo_andamento_relevante') >= getWeight(eventTipo)) {
          eventTipo = 'novo_andamento_relevante';
          eventResumo = upd.nomeUltimo || eventResumo;
        }
      }
    } catch (e) {
      console.error('[auditCaseCoreSystem] DataJud fail', protocolo, e);
    }
  }

  // --- BLOCO DJEN ---
  if (mode === 'djen' || mode === 'both') {
    try {
      const djenRes = await fetchDjenComunicacoes(protocolo);
      if (djenRes.success) {
        djenOk = true;
        comunicacoes = djenRes.items || [];
        const djenSync = detectarNovaComunicacaoDjen(target.ultimoRetorno, comunicacoes);
        const dataDjenRef = djenSync.dataUltima || target.djen_ultima_data || null;

        patch.djen_nova_comunicacao = djenSync.alerta === true || 
          (!!target.djen_nova_comunicacao && movimentoAindaPosRetorno(dataDjenRef, target.ultimoRetorno));

        const resumoKw = djenSync.resumo || (comunicacoes[0]?.texto ? summarizeDjenKeywords(comunicacoes[0].texto) : null) || target.djen_ultimo_resumo || null;

        Object.assign(patch, {
          djen_ultima_data: djenSync.dataUltima || target.djen_ultima_data || null,
          djen_ultimo_resumo: resumoKw,
          djen_ultimo_link: djenSync.link || target.djen_ultimo_link || null,
          djen_count: djenRes.count ?? target.djen_count ?? comunicacoes.length,
          djen_consultado_em: new Date().toISOString()
        });

        // Hierarquia de Mérito DJEN
        if (djenSync.alerta && comunicacoes[0]) {
          const djenClass = classifyEventFromText(comunicacoes[0]?.texto);
          if (getWeight(djenClass.tipo) >= getWeight(eventTipo)) {
            eventTipo = djenClass.tipo as EventoTipo;
            eventResumo = resumoKw || eventResumo;
          }
        }
      }
    } catch (e) {
      console.error('[auditCaseCoreSystem] DJEN fail', protocolo, e);
    }
  }

  if (!datajudOk && !djenOk) {
    return { success: false, error: "OFFLINE", case: target, casePatch: {}, movimentos: [], comunicacoes: [] };
  }

  patch.evento_tipo = eventTipo;
  patch.evento_resumo = eventResumo;
  patch.evento_fonte = (patch.tem_atualizacao_pos_retorno && patch.djen_nova_comunicacao) ? 'ambos' : patch.tem_atualizacao_pos_retorno ? 'datajud' : 'djen';
  patch.tem_novo_andamento = !!(patch.tem_atualizacao_pos_retorno || patch.djen_nova_comunicacao);
  
  await updateCaseDataJudSystem(dbItem.id, patch);
  const updatedCase = processarCaso({ ...target, ...patch });

  return {
    success: true,
    casePatch: patch,
    case: updatedCase,
    movimentos,
    comunicacoes
  };
}

export async function scanSingleCaseAction(protocolo: string, options: { mode?: 'datajud'|'djen'|'both', fast?: boolean } = {}) {
  const { empresa_id } = await getUserContext();
  if (!empresa_id) return { success: false, error: "401" };
  const safeEmpresaId = String(empresa_id);
  return await auditCaseCoreSystem(protocolo, safeEmpresaId, options.mode || 'both', { fast: options.fast });
}

export async function scanOneDataJudAction(protocolo: string) {
  return scanSingleCaseAction(protocolo, { mode: 'datajud', fast: true });
}

export async function scanOneDjenAction(protocolo: string) {
  return scanSingleCaseAction(protocolo, { mode: 'djen', fast: true });
}

export async function runDataJudScanAction(empresaId: string) {
  try {
    if (!empresaId) return { success: false, error: "Missing ID" };
    const cases = await getStoredCasesForEmpresa(empresaId, true);
    const activeCases = cases.filter(c => !isCasoEncerrado(c));
    let updated = 0;
    const targetCases = activeCases.slice(0, 20);
    for (const c of targetCases) {
      const res = await auditCaseCoreSystem(c.protocolo, empresaId, 'both', { fast: true });
      const patch = (res.casePatch as Record<string, any>) || {};
      if (res.success && (patch.tem_atualizacao_pos_retorno || patch.djen_nova_comunicacao)) {
        updated++;
      }
    }
    return { success: true, scanned: targetCases.length, updated };
  } catch (e: any) {
    return { success: false, error: e.message };
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

export async function clearDataJudAuditAction(protocolo: string) {
  const { empresa_id } = await getUserContext();
  if (!empresa_id) return { success: false };

  const admin = await getSupabaseAdmin();
  const { data: dbItem } = await admin
    .from('processos')
    .select('id, dados')
    .eq('protocolo_ref', protocolo)
    .eq('empresa_id', empresa_id)
    .maybeSingle();

  if (!dbItem) return { success: false };

  const patch = {
    tem_atualizacao_pos_retorno: false,
    djen_nova_comunicacao: false,
    tem_novo_andamento: false,
  };

  const updatedDados = { ...(dbItem.dados as any), ...patch };

  const { error } = await admin
    .from('processos')
    .update({ ...patch, dados: updatedDados })
    .eq('id', dbItem.id);

  return { success: !error };
}

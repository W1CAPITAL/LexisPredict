'use server';

/**
 * @copyright 2026 Davi Alves Figueredo / W1 Capital Assessoria Financeira Ltda.
 * @license Proprietary - All rights reserved.
 * REPOSITÓRIO DE AÇÕES DE GABINETE — NÚCLEO SYSTEM IDEMPOTENTE
 */

import {
  getStoredCasesForEmpresa,
  saveStoredCasesForEmpresa,
  getUserContext,
  updateCaseDataJudSystem,
  getSupabaseAdmin,
} from '@/lib/server-db';
import { createClient } from '@/lib/supabase/server';
import { LegalCase, processarCaso, EventoTipo } from '@/lib/case-logic';
import { isCasoEncerrado } from '@/lib/status-encerrado';
import { fetchDataJud } from '@/lib/datajud';
import {
  detectarAtualizacaoPosRetorno,
  detectarEncerradoNoTribunal,
  detectarCumprimentoSentenca,
} from '@/lib/datajud-sync';
import { analisarBuscaApreensao } from '@/lib/busca-apreensao';
import {
  fetchDjenComunicacoes,
  classifyEventFromText,
  summarizeDjenKeywords,
} from '@/lib/djen';
import { detectarNovaComunicacaoDjen } from '@/lib/djen-sync';
import { parseISO, isAfter, parse, isValid } from 'date-fns';

function movimentoAindaPosRetorno(
  dataEventoStr: string | null | undefined,
  ultimoRetornoStr: string | null | undefined
): boolean {
  if (!dataEventoStr) return false;
  if (!ultimoRetornoStr || !String(ultimoRetornoStr).trim() || ultimoRetornoStr === '-') return true;
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

function getWeight(t: string | null | undefined): number {
  if (!t) return 0;
  const weights: Record<string, number> = {
    ba: 100,
    transito_ou_baixa: 90,
    transito_baixa: 90,
    sentenca_procedente: 85,
    sentenca_improcedente: 85,
    sentenca_parcial: 84,
    liminar: 83,
    audiencia_julgamento: 80,
    audiencia_instrucao: 79,
    audiencia_conciliacao: 78,
    cancelamento_distribuicao: 75,
    cumprimento_sentenca: 70,
    novo_andamento_relevante: 50,
    rotina: 10,
  };
  return weights[t] ?? 0;
}

export async function fetchRepoCases() {
  const { empresa_id } = await getUserContext();
  if (!empresa_id) return [];
  return await getStoredCasesForEmpresa(empresa_id);
}

export async function syncRepoCases(cases: LegalCase[]) {
  const { empresa_id } = await getUserContext();
  if (!empresa_id) return { success: false, message: 'Sessão expirada.' };
  return await saveStoredCasesForEmpresa(cases, empresa_id);
}

export async function fetchRepoNotes() {
  const { getStoredNotes } = await import('@/lib/server-db');
  return await getStoredNotes();
}

/**
 * NÚCLEO SOBERANO — worker (service role) e UI usam o mesmo rito.
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

  if (!dbItem) return { success: false, error: 'NOT_FOUND' };

  const target = processarCaso({
    ...(dbItem.dados as any),
    id: dbItem.id.toString(),
    ultimoRetorno: dbItem.ultimo_retorno ?? (dbItem.dados as any)?.ultimoRetorno,
    tem_atualizacao_pos_retorno: dbItem.tem_atualizacao_pos_retorno ?? (dbItem.dados as any)?.tem_atualizacao_pos_retorno,
    djen_nova_comunicacao: dbItem.djen_nova_comunicacao ?? (dbItem.dados as any)?.djen_nova_comunicacao,
    datajud_ultimo_movimento: dbItem.datajud_ultimo_movimento ?? (dbItem.dados as any)?.datajud_ultimo_movimento,
    datajud_ultimo_nome: dbItem.datajud_ultimo_nome ?? (dbItem.dados as any)?.datajud_ultimo_nome,
    datajud_encerrado_tribunal: dbItem.datajud_encerrado_tribunal ?? (dbItem.dados as any)?.datajud_encerrado_tribunal,
    datajud_encerrado_motivo: dbItem.datajud_encerrado_motivo ?? (dbItem.dados as any)?.datajud_encerrado_motivo,
    indicio_busca_apreensao: dbItem.indicio_busca_apreensao ?? (dbItem.dados as any)?.indicio_busca_apreensao,
    em_cumprimento_sentenca: dbItem.em_cumprimento_sentenca ?? (dbItem.dados as any)?.em_cumprimento_sentenca,
    djen_ultima_data: dbItem.djen_ultima_data ?? (dbItem.dados as any)?.djen_ultima_data,
    djen_ultimo_resumo: dbItem.djen_ultimo_resumo ?? (dbItem.dados as any)?.djen_ultimo_resumo,
    djen_ultimo_link: dbItem.djen_ultimo_link ?? (dbItem.dados as any)?.djen_ultimo_link,
    evento_tipo: (dbItem.dados as any)?.evento_tipo,
    evento_resumo: (dbItem.dados as any)?.evento_resumo,
  });

  if (isCasoEncerrado(target)) {
    return { success: true, skipped: true, case: target, casePatch: {}, movimentos: [], comunicacoes: [] };
  }

  const patch: Record<string, any> = {};
  let movimentos: any[] = [];
  let comunicacoes: any[] = [];
  let eventTipo: EventoTipo = (target.evento_tipo as EventoTipo) || 'rotina';
  let eventResumo: string | null = target.evento_resumo ?? null;
  let datajudOk = false;
  let djenOk = false;

  // --- DATAJUD ---
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
        patch.tem_atualizacao_pos_retorno =
          upd.alerta === true ||
          (!!target.tem_atualizacao_pos_retorno &&
            movimentoAindaPosRetorno(dataMovRef, target.ultimoRetorno));

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
          tribunal: dataJud.tribunal || target.tribunal,
        });

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

  // --- DJEN ---
  if (mode === 'djen' || mode === 'both') {
    try {
      const djenRes = await fetchDjenComunicacoes(protocolo);
      if (djenRes.success) {
        djenOk = true;
        comunicacoes = djenRes.items || [];
        const djenSync = detectarNovaComunicacaoDjen(target.ultimoRetorno, comunicacoes);
        const dataDjenRef = djenSync.dataUltima || target.djen_ultima_data || null;

        patch.djen_nova_comunicacao =
          djenSync.alerta === true ||
          (!!target.djen_nova_comunicacao &&
            movimentoAindaPosRetorno(dataDjenRef, target.ultimoRetorno));

        const resumoKw =
          djenSync.resumo ||
          (comunicacoes[0]?.texto ? summarizeDjenKeywords(comunicacoes[0].texto) : null) ||
          target.djen_ultimo_resumo ||
          null;

        Object.assign(patch, {
          djen_ultima_data: djenSync.dataUltima || target.djen_ultima_data || null,
          djen_ultimo_resumo: resumoKw,
          djen_ultimo_link: djenSync.link || target.djen_ultimo_link || null,
          djen_count: djenRes.count ?? target.djen_count ?? comunicacoes.length,
          djen_consultado_em: new Date().toISOString(),
        });

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
    return {
      success: false,
      error: 'Nenhuma fonte respondeu',
      case: target,
      casePatch: {},
      movimentos: [],
      comunicacoes: [],
    };
  }

  // Nunca rebaixar mérito para rotina/null se já havia sinal forte
  patch.evento_tipo = eventTipo;
  patch.evento_resumo = eventResumo;
  patch.evento_fonte =
    patch.tem_atualizacao_pos_retorno && patch.djen_nova_comunicacao
      ? 'ambos'
      : patch.tem_atualizacao_pos_retorno
        ? 'datajud'
        : patch.djen_nova_comunicacao
          ? 'djen'
          : target.evento_fonte || (datajudOk ? 'datajud' : 'djen');

  await updateCaseDataJudSystem(dbItem.id, patch);
  const updatedCase = processarCaso({ ...target, ...patch });

  return {
    success: true,
    casePatch: patch,
    case: updatedCase,
    movimentos,
    comunicacoes,
  };
}

export async function scanSingleCaseAction(
  protocolo: string,
  options: { mode?: 'datajud' | 'djen' | 'both'; fast?: boolean } = {}
) {
  const { empresa_id } = await getUserContext();
  if (!empresa_id) return { success: false, error: '401' };
  return await auditCaseCoreSystem(protocolo, empresa_id, options.mode || 'both', {
    fast: options.fast,
  });
}

/** Wrappers para imports legados — NÃO remover */
export async function scanOneDataJudAction(protocolo: string) {
  return scanSingleCaseAction(protocolo, { mode: 'datajud', fast: true });
}
export async function scanOneDjenAction(protocolo: string) {
  return scanSingleCaseAction(protocolo, { mode: 'djen', fast: true });
}

export async function runDataJudScanAction(empresaId?: string) {
  try {
    let id = empresaId;
    if (!id) {
      const ctx = await getUserContext();
      if (!ctx.empresa_id) return { success: false, error: 'Sessão expirada.' };
      id = ctx.empresa_id;
    }
    const cases = await getStoredCasesForEmpresa(id, true);
    const targetCases = cases.filter((c) => !isCasoEncerrado(c)).slice(0, 20);
    let updated = 0;
    for (const c of targetCases) {
      const res = await auditCaseCoreSystem(c.protocolo, id, 'both', { fast: true });
      if (
        res.success &&
        (res.casePatch?.tem_atualizacao_pos_retorno || res.casePatch?.djen_nova_comunicacao)
      ) {
        updated++;
      }
    }
    return { success: true, scanned: targetCases.length, updated };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

export async function fetchTeamPerformanceAction() {
  const { getEmpresaUsers } = await import('@/lib/server-db');
  const { empresa_id } = await getUserContext();
  if (!empresa_id) return { users: [], cases: [] };
  const [users, cases] = await Promise.all([
    getEmpresaUsers(),
    getStoredCasesForEmpresa(empresa_id, true),
  ]);
  return { users, cases };
}

export async function clearDataJudAuditAction(protocolo: string) {
  const { empresa_id } = await getUserContext();
  if (!empresa_id) return { success: false };
  const supabase = await createClient();
  const { data: dbItem } = await supabase
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
  const { error } = await supabase
    .from('processos')
    .update({ ...patch, dados: updatedDados })
    .eq('id', dbItem.id);
  return { success: !error };
}

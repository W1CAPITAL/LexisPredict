'use server';
/**
 * @copyright 2026 Davi Alves Figueredo / W1 Capital Assessoria Financeira Ltda.
 * @license Proprietary - All rights reserved.
 * REPOSITÓRIO DE AÇÕES DE GABINETE v700.0 ELITE - NÚCLEO SYSTEM UNIFICADO
 */
import { logScanMetric, logAlertEvent } from '@/lib/scan-metrics';
import {
  getStoredCasesForEmpresa,
  saveStoredCasesForEmpresa,
  getUserContext,
  updateCaseDataJudSystem,
  getSupabaseAdmin
} from '@/lib/server-db';
import { normalizeMovimentosList } from '@/lib/timeline-normalize';
import { LegalCase, processarCaso, EventoTipo } from '@/lib/case-logic';
import { isCasoEncerrado } from '@/lib/status-encerrado';
import { fetchDataJud } from '@/lib/datajud';
import { detectarAtualizacaoPosRetorno, detectarEncerradoNoTribunal, detectarCumprimentoSentenca } from '@/lib/datajud-sync';
import { analisarBuscaApreensao } from '@/lib/busca-apreensao';
import { fetchDjenComunicacoes, classifyEventFromText, summarizeDjenKeywords } from '@/lib/djen';
import { detectarNovaComunicacaoDjen } from '@/lib/djen-sync';
import { isAfter, parse, isValid, parseISO } from 'date-fns';

function movimentoAindaPosRetorno(
  dataEventoStr: string | null | undefined,
  ultimoRetornoStr: string | null | undefined
): boolean {
  if (!dataEventoStr) return false;
  if (
    !ultimoRetornoStr ||
    !String(ultimoRetornoStr).trim() ||
    ultimoRetornoStr === '-' ||
    ultimoRetornoStr === '0'
  ) {
    return true;
  }

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
  return weights[t] || 0;
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

/**
 * NÚCLEO SOBERANO DE AUDITORIA (SYSTEM MODE)
 */
export async function auditCaseCoreSystem(
  protocolo: string,
  empresaId: string,
  mode: 'datajud' | 'djen' | 'both' = 'both',
  options: { fast?: boolean; useClaudeAi?: boolean } = {}
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
    ultimoRetorno: dbItem.ultimo_retorno,
  });

  if (isCasoEncerrado(target)) {
    return {
      success: true,
      skipped: true,
      case: target,
      casePatch: {},
      movimentos: [],
      comunicacoes: [],
    };
  }

  const patch: Record<string, any> = {};
  let movimentos: any[] = [];
  let comunicacoes: any[] = [];

  let eventTipo: EventoTipo = (target.evento_tipo as EventoTipo) || 'rotina';
  let eventResumo: string | null = target.evento_resumo || null;

  let datajudOk = false;
  let djenOk = false;

  // Pré-busca paralela (both) — reduz lag do Sugerir resposta / auditoria pontual
  let preDataJud: any = null;
  let preDjen: any = null;
  if (mode === 'both') {
    const [djS, djenS] = await Promise.allSettled([
      fetchDataJud(protocolo, 1, { ...options, fast: options.fast !== false }),
      fetchDjenComunicacoes(protocolo),
    ]);
    if (djS.status === 'fulfilled') preDataJud = djS.value;
    if (djenS.status === 'fulfilled') preDjen = djenS.value;
  }

  // --- BLOCO DATAJUD ---
  if (mode === 'datajud' || mode === 'both') {
    try {
      const dataJud =
        mode === 'both'
          ? preDataJud
          : await fetchDataJud(protocolo, 1, options);
      if (dataJud && !dataJud.error) {
        datajudOk = true;
        movimentos = normalizeMovimentosList(dataJud.movimentos || []);
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
          // Se encerrado no tribunal, cumprimento ativo = false; senão grava detecção (mantém se já marcado)
          em_cumprimento_sentenca: enc.encerrado
            ? false
            : !!(cump.ativo || target.em_cumprimento_sentenca),
          cumprimento_sentenca_motivo: enc.encerrado
            ? null
            : (cump.motivo || target.cumprimento_sentenca_motivo || null),
          cumprimento_sentenca_consultado_em: new Date().toISOString(),
          datajud_consultado_em: new Date().toISOString(),
          tribunal: dataJud.tribunal || target.tribunal,
        });

        // Hierarquia de Mérito DataJud (com sentença explícita)
        const textoMovs = movimentos
          .slice(0, 25)
          .map(
            (m: any) =>
              `${m.nome || ''} ${m.complemento || ''} ${m.descricao || ''}`.toUpperCase()
          )
          .join(' || ');

        if (ba.indicio && getWeight('ba') >= getWeight(eventTipo)) {
          eventTipo = 'ba';
          eventResumo = ba.motivo || eventResumo;
        } else if (enc.encerrado && getWeight('transito_ou_baixa') >= getWeight(eventTipo)) {
          eventTipo = 'transito_ou_baixa';
          eventResumo = enc.motivo || eventResumo;
        } else if (
          (textoMovs.includes('PARCIALMENTE PROCEDENTE') ||
            textoMovs.includes('PROCEDENTE EM PARTE')) &&
          getWeight('sentenca_parcial') >= getWeight(eventTipo)
        ) {
          eventTipo = 'sentenca_parcial';
          eventResumo = 'Sentença parcialmente procedente';
        } else if (
          (textoMovs.includes('JULGADO PROCEDENTE') ||
            textoMovs.includes('JULGADA PROCEDENTE') ||
            (textoMovs.includes('PROCEDENTE') && !textoMovs.includes('IMPROCEDENTE'))) &&
          getWeight('sentenca_procedente') >= getWeight(eventTipo)
        ) {
          eventTipo = 'sentenca_procedente';
          eventResumo = 'Sentença procedente';
        } else if (
          (textoMovs.includes('IMPROCEDENTE') ||
            textoMovs.includes('IMPROCEDÊNCIA') ||
            textoMovs.includes('NEGADO PROVIMENTO')) &&
          getWeight('sentenca_improcedente') >= getWeight(eventTipo)
        ) {
          eventTipo = 'sentenca_improcedente';
          eventResumo = 'Sentença improcedente';
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
      const djenRes =
        mode === 'both' ? preDjen : await fetchDjenComunicacoes(protocolo);
      if (djenRes && djenRes.success) {
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
      error: 'OFFLINE',
      case: target,
      casePatch: {},
      movimentos: [],
      comunicacoes: [],
    };
  }

  if (mode === 'datajud' || mode === 'both') {
    await logScanMetric({
      empresaId,
      source: 'datajud',
      success: datajudOk,
      protocolo,
    });
  }
  if (mode === 'djen' || mode === 'both') {
    await logScanMetric({
      empresaId,
      source: 'djen',
      success: djenOk,
      protocolo,
    });
  }

  patch.evento_tipo = eventTipo;
  patch.evento_resumo = eventResumo;
  patch.evento_fonte =
    patch.tem_atualizacao_pos_retorno && patch.djen_nova_comunicacao
      ? 'ambos'
      : patch.tem_atualizacao_pos_retorno
        ? 'datajud'
        : patch.djen_nova_comunicacao
          ? 'djen'
          : null;
  patch.tem_novo_andamento = !!(
    patch.tem_atualizacao_pos_retorno || patch.djen_nova_comunicacao
  );

  if (patch.indicio_busca_apreensao || target.indicio_busca_apreensao) {
    patch.scan_priority = 100;
  } else if (patch.datajud_encerrado_tribunal || target.datajud_encerrado_tribunal) {
    patch.scan_priority = 90;
  } else if (patch.tem_novo_andamento) {
    patch.scan_priority = 80;
  } else if (patch.em_cumprimento_sentenca || target.em_cumprimento_sentenca) {
    patch.scan_priority = 70;
  } else {
    patch.scan_priority = 40;
  }

  // --- IA Claude via OmniRoute: flags (encerrado, cumprimento, mérito, BA, prioridade) ---
  let aiLogLine: string | null = null;
  let aiEngine: string | null = null;
  try {
    const { enrichScanPatchWithAi } = await import('@/lib/ai/scan-ai-enrich');
    const preferredAi =
      process.env.SCAN_AI_PREFERRED ||
      process.env.LEXIS_SCAN_AI ||
      'claude';
    // Claude/OmniRoute só se o operador ativar no Scanner (useClaudeAi)
    // ou SCAN_AI_FORCE=1 no ambiente
    const forceEnv = process.env.SCAN_AI_FORCE === '1' || process.env.SCAN_AI_FORCE === 'true';
    const useClaude = options.useClaudeAi === true || forceEnv;
    if (!useClaude) {
      // skip IA — heurística DataJud/DJEN já aplicada no patch
    } else {
    const enriched = await enrichScanPatchWithAi({
      protocolo,
      cliente: target.cliente,
      movimentos,
      comunicacoes,
      patch,
      preferred: preferredAi,
      enabled: true,
    });
    Object.assign(patch, enriched.patch);
    aiEngine = enriched.aiEngine;
    aiLogLine = enriched.aiLogLine || (
      enriched.aiEngine
        ? `[Claude AI / ${enriched.aiEngine}] ${patch.evento_resumo || 'análise concluída'}${patch.ai_flags_label ? ' | ' + patch.ai_flags_label : ''}`
        : null
    );
    if (enriched.aiEngine) {
      console.info(
        '[scan-ai]',
        protocolo,
        enriched.aiEngine,
        patch.evento_tipo,
        patch.ai_flags_label,
        patch.alerta_ia
      );
    }
    } // end useClaude
  } catch (e: any) {
    console.error('[scan-ai] skip', e?.message || e);
  }

  if (patch.tem_novo_andamento) {
    await logAlertEvent({
      empresaId,
      protocolo,
      eventType: 'raised',
      source: patch.evento_fonte || undefined,
      payload: { evento_tipo: patch.evento_tipo, resumo: patch.evento_resumo },
    });
  }

  const saved = await updateCaseDataJudSystem(dbItem.id, patch);
  if (!saved.success) {
    console.error('[auditCaseCoreSystem] persist failed', protocolo, saved.error);
    return {
      success: false,
      error: saved.error || 'PERSIST_FAIL',
      case: target,
      casePatch: patch,
      movimentos,
      comunicacoes,
    };
  }

    const updatedCase = processarCaso({ ...target, ...patch });
  return {
    success: true,
    casePatch: patch,
    case: updatedCase,
    movimentos: normalizeMovimentosList(movimentos).slice(0, 80),
    comunicacoes,
    aiEngine: aiEngine || patch.ai_engine || null,
    aiLogLine: aiLogLine || patch.ai_log_line || null,
    aiFlagsLabel: patch.ai_flags_label || null,
  };
}

export async function scanSingleCaseAction(
  protocolo: string,
  options: { mode?: 'datajud' | 'djen' | 'both'; fast?: boolean; useClaudeAi?: boolean } = {}
) {
  const { empresa_id } = await getUserContext();
  if (!empresa_id) return { success: false, error: '401' };
  const safeEmpresaId = String(empresa_id);
  return await auditCaseCoreSystem(
    protocolo,
    safeEmpresaId,
    options.mode || 'both',
    { fast: options.fast, useClaudeAi: options.useClaudeAi === true }
  );
}

export async function scanOneDataJudAction(protocolo: string) {
  return scanSingleCaseAction(protocolo, { mode: 'datajud', fast: true });
}

export async function scanOneDjenAction(protocolo: string) {
  return scanSingleCaseAction(protocolo, { mode: 'djen', fast: true });
}

export async function runDataJudScanAction(empresaId: string) {
  try {
    if (!empresaId) return { success: false, error: 'Missing ID' };
    const cases = await getStoredCasesForEmpresa(empresaId, true);
    const activeCases = cases.filter((c) => !isCasoEncerrado(c));
    let updated = 0;
    const targetCases = activeCases.slice(0, 20);
    for (const c of targetCases) {
      const res = await auditCaseCoreSystem(c.protocolo, empresaId, 'both', {
        fast: true,
      });
      const p = (res.casePatch as Record<string, any>) || {};
      if (res.success && (p.tem_atualizacao_pos_retorno || p.djen_nova_comunicacao)) {
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
  const {
    getEmpresaUsers,
    getStoredCasesForEmpresa,
    getUserContext,
  } = await import('@/lib/server-db');
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

  const admin = await getSupabaseAdmin();
  const { data: dbItem } = await admin
    .from('processos')
    .select('id, dados, protocolo_ref')
    .eq('protocolo_ref', protocolo)
    .eq('empresa_id', empresa_id)
    .maybeSingle();

  if (!dbItem) return { success: false };

  const patch = {
    tem_atualizacao_pos_retorno: false,
    djen_nova_comunicacao: false,
    tem_novo_andamento: false,
    alert_ack_at: new Date().toISOString(),
  };

  // Usa o update seguro (tem_novo_andamento só no JSON dados)
  const saved = await updateCaseDataJudSystem(dbItem.id, patch);
  if (!saved.success) return { success: false };

  await admin.from('alert_events').insert({
    empresa_id,
    protocolo_ref: dbItem.protocolo_ref,
    event_type: 'acked',
    source: 'ambos',
    payload: { via: 'clearDataJudAuditAction' },
  });

  return { success: true };
}

/**
 * Recalibra status/prazo de toda a carteira da empresa (processarCaso em lote).
 * Não chama DataJud — só lógica local de Vencido / É Hoje / Atenção / No Prazo.
 */
export async function recalibrateCasesAction() {
  try {
    const { empresa_id } = await getUserContext();
    if (!empresa_id) return { success: false, error: 'Sessão expirada', updated: 0 };

    const cases = await getStoredCasesForEmpresa(empresa_id, true);
    if (!cases.length) return { success: true, updated: 0, message: 'Nenhum processo.' };

    const recalibrated = cases.map((c) => processarCaso({ ...c }));
    const res = await saveStoredCasesForEmpresa(recalibrated, empresa_id, true);
    if (!res.success) return { success: false, error: res.message || 'Falha ao salvar', updated: 0 };

    return {
      success: true,
      updated: recalibrated.length,
      message: `Prazos recalibrados em ${recalibrated.length} processos.`,
    };
  } catch (e: any) {
    return { success: false, error: e?.message || 'Erro', updated: 0 };
  }
}

/** Parecer Claude AI para Auditoria 3D (opt-in no modal). */
export async function generateAudit3dClaudeAction(input: {
  protocolo: string;
  cliente?: string;
  movimentos?: any[];
  comunicacoes?: any[];
  useClaude?: boolean;
}) {
  if (input.useClaude === false) {
    return { success: false as const, error: 'Claude desativado' };
  }
  try {
    const { analyzeCaseWithClaude } = await import('@/lib/ai/claude-surfaces');
    const mov = (input.movimentos || [])
      .slice(0, 12)
      .map((m: any) => `- ${m.dataHora || m.data || ''} ${m.nome || m.descricao || ''}`)
      .join('\n');
    const djen = (input.comunicacoes || [])
      .slice(0, 8)
      .map((c: any) => `- ${c.data_disponibilizacao || ''} ${String(c.texto || '').slice(0, 200)}`)
      .join('\n');
    const blob = `CNJ ${input.protocolo} ${input.cliente || ''}\nDATAJUD:\n${mov}\nDJEN:\n${djen}`;
    const r = await analyzeCaseWithClaude(blob, 'audit3d', true);
    if (!r) return { success: false as const, error: 'Sem resposta' };
    console.info('[audit3d-claude]', r.logLine);
    return {
      success: true as const,
      texto: r.text,
      engine: r.engineLabel,
      logLine: r.logLine,
    };
  } catch (e: any) {
    return { success: false as const, error: e?.message || 'Falha Claude' };
  }
}

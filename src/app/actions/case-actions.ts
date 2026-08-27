'use server';
/**
 * @copyright 2026 Davi Alves Figueredo / W1 Capital Assessoria Financeira Ltda.
 * @license Proprietary - All rights reserved.
 * REPOSITÓRIO DE AÇÕES DE GABINETE v700.0 ELITE - NÚCLEO SYSTEM UNIFICADO
 */
import { logScanMetric, logAlertEvent } from '@/lib/scan-metrics';
import {
  getStoredCasesForEmpresa,
  getStoredCasesPageForEmpresa,
  saveStoredCasesForEmpresa,
  getUserContext,
  updateCaseDataJudSystem,
  getSupabaseAdmin
} from '@/lib/server-db';
import { normalizeMovimentosList } from '@/lib/timeline-normalize';
import { LegalCase, processarCaso, EventoTipo } from '@/lib/case-logic';
import { isCasoEncerrado } from '@/lib/status-encerrado';
import { decidirEncerramentoScan, aplicarDecisaoNoPatch } from '@/lib/auto-encerrar-scan';
import { fetchDataJud } from '@/lib/datajud';

/** Uma retentativa em timeout/rede para DataJud/DJEN (não multiplica lote). */
async function withOneRetry<T>(fn: () => Promise<T>, label: string): Promise<T> {
  try {
    return await fn();
  } catch (e: any) {
    const msg = String(e?.message || e).toLowerCase();
    if (msg.includes('timeout') || msg.includes('network') || msg.includes('fetch') || msg.includes('econn') || msg.includes('503') || msg.includes('429')) {
      await new Promise((r) => setTimeout(r, 800));
      return await fn();
    }
    throw e;
  }
}

import { detectarAtualizacaoPosRetorno, detectarEncerradoNoTribunal, detectarCumprimentoSentenca, analisarProcedenciaECumprimento } from '@/lib/datajud-sync';
import { extrairCreditoSentenca } from '@/lib/credito-sentenca-extract';
import { applyReconciliacaoAoPatch } from '@/lib/reconciliar-cumprimento-flags';
import { analisarBuscaApreensao } from '@/lib/busca-apreensao';
import { fetchDjenComunicacoes, classifyEventFromText, summarizeDjenKeywords } from '@/lib/djen';
import { detectarNovaComunicacaoDjen } from '@/lib/djen-sync';
import { resolveDjenPublicacaoLink } from '@/lib/djen';
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


export async function fetchRepoCasesPageAction(limit = 250, offset = 0, adminView = false) {
  const { empresa_id } = await getUserContext();
  if (!empresa_id) return [];
  return await getStoredCasesPageForEmpresa(empresa_id, limit, offset, adminView);
}

export async function fetchRepoCases() {
  const ctx = await getUserContext();
  if (!ctx.empresa_id) return [];
  // Superadmin / Supervisor: todos. Demais cargos: só os próprios.
  const wide = !!(ctx.isSuperAdmin || ctx.isSupervisor);
  return await getStoredCasesForEmpresa(ctx.empresa_id, wide);
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

  // Nao pular encerrados: Sugerir resposta / Auditoria precisam da cronologia
  // (scripts e DJEN ainda fazem sentido para baixa / trânsito).

  const patch: Record<string, any> = {};
  let movimentos: any[] = [];
  let comunicacoes: any[] = [];

  let eventTipo: EventoTipo = (target.evento_tipo as EventoTipo) || 'rotina';
  let eventResumo: string | null = target.evento_resumo || null;

  let datajudOk = false;
  let djenOk = false;

  // Pré-busca paralela (both) — Sugerir resposta / auditoria
  let preDataJud: any = null;
  let preDjen: any = null;
  const digits = String(protocolo || '').replace(/\D/g, '');
  const protoSafe = digits.length === 20 ? digits : protocolo;
  if (mode === 'both') {
    const [djS, djenS] = await Promise.allSettled([
      fetchDataJud(protoSafe, 1, { ...options, fast: options.fast !== false }),
      fetchDjenComunicacoes(protoSafe, {
        dataInicio: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      }),
    ]);
    if (djS.status === 'fulfilled') preDataJud = djS.value;
    if (djenS.status === 'fulfilled') preDjen = djenS.value;
    // Retry DJEN se falhou na paralela
    if (!preDjen || preDjen.success === false) {
      try {
        await new Promise((r) => setTimeout(r, 800));
        preDjen = await fetchDjenComunicacoes(protoSafe, {
          dataInicio: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        });
      } catch {
        /* */
      }
    }
    // Retry DataJud se erro — attempt=2 fura o cache (attempt=1 só lê memória)
    if (!preDataJud || preDataJud.error) {
      try {
        await new Promise((r) => setTimeout(r, 600));
        preDataJud = await fetchDataJud(protoSafe, 2, { ...options, fast: false });
      } catch {
        /* */
      }
    }
  }

  // --- BLOCO DATAJUD ---
  if (mode === 'datajud' || mode === 'both') {
    try {
      const dataJud =
        mode === 'both'
          ? preDataJud
          : await fetchDataJud(protoSafe || protocolo, 1, { ...options, fast: options.fast !== false });
      if (dataJud && !dataJud.error) {
        datajudOk = true;
        movimentos = normalizeMovimentosList(dataJud.movimentos || []);
        const upd = detectarAtualizacaoPosRetorno(target.ultimoRetorno, movimentos);
        const enc = detectarEncerradoNoTribunal(movimentos);
        const ba = analisarBuscaApreensao(dataJud);
        const cump = detectarCumprimentoSentenca(movimentos);
        const analiseExec = analisarProcedenciaECumprimento(
          movimentos,
          dataJud.classe?.codigo || null,
          upd.nomeUltimo || target.datajud_ultimo_nome || null
        );

        const dataMovRef = upd.dataUltimo || target.datajud_ultimo_movimento || null;

        patch.tem_atualizacao_pos_retorno =
          upd.alerta === true ||
          (!!target.tem_atualizacao_pos_retorno &&
            movimentoAindaPosRetorno(dataMovRef, target.ultimoRetorno));

        Object.assign(patch, {
          datajud_ultimo_movimento: upd.dataUltimo || target.datajud_ultimo_movimento || null,
          datajud_ultimo_nome: upd.nomeUltimo || target.datajud_ultimo_nome || null,
          datajud_encerrado_tribunal: !!(
            // sticky: uma vez true, não apaga em re-scan parcial
            target.datajud_encerrado_tribunal ||
            enc.encerrado
          ),
          datajud_encerrado_motivo: enc.motivo || target.datajud_encerrado_motivo || null,
          indicio_busca_apreensao: !!(ba.indicio || target.indicio_busca_apreensao),
          busca_apreensao_confianca: ba.confianca ?? target.busca_apreensao_confianca ?? null,
          busca_apreensao_motivo: ba.motivo || target.busca_apreensao_motivo || null,
          // Cumprimento é INDEPENDENTE do processo principal extinto.
          // Só "desliga" ativo se a própria fase de cumprimento foi satisfeita/extinta.
          em_cumprimento_sentenca: !!(
            cump.ativo ||
            analiseExec.em_cumprimento_sentenca ||
            target.em_cumprimento_sentenca ||
            analiseExec.cumprimento_encerrado
          ),
          cumprimento_sentenca_motivo:
            cump.motivo ||
            analiseExec.procedente_motivo ||
            target.cumprimento_sentenca_motivo ||
            null,
          cumprimento_sentenca_consultado_em: new Date().toISOString(),
          cumprimento_ativo: !!analiseExec.cumprimento_ativo,
          cumprimento_encerrado: !!analiseExec.cumprimento_encerrado,
          status_executivo: analiseExec.status_executivo || null,
          // Procedência e cumprimento pendente (módulo executivo)
          is_procedente: analiseExec.is_procedente || target.is_procedente || false,
          procedente_motivo: analiseExec.procedente_motivo || target.procedente_motivo || null,
          // Lote3: NÃO preservar pendente se já em cumprimento (evita flag dupla)
          cumprimento_pendente_necessario: !!(
            analiseExec.cumprimento_pendente_necessario &&
            !analiseExec.em_cumprimento_sentenca &&
            !analiseExec.cumprimento_encerrado &&
            !analiseExec.cumprimento_ativo
          ),
          data_transito_julgado: analiseExec.data_transito_julgado || target.data_transito_julgado || null,
          detalhes_execucao: {
            ...(typeof target.detalhes_execucao === 'object' && target.detalhes_execucao
              ? target.detalhes_execucao
              : {}),
            ...analiseExec.detalhes_execucao,
            merito_tipo: analiseExec.merito_tipo,
            status_executivo: analiseExec.status_executivo,
            cumprimento_ativo: analiseExec.cumprimento_ativo,
            cumprimento_encerrado: analiseExec.cumprimento_encerrado,
            principal_encerrado: !!enc.encerrado,
            oportunidade_instaurar: (analiseExec as any).oportunidade_instaurar || null,
            scanned_at: new Date().toISOString(),
          },
          oportunidade_instaurar: (analiseExec as any).oportunidade_instaurar || null,
          oportunidade_score: (analiseExec as any).oportunidade_instaurar?.score ?? null,
          oportunidade_elegivel: !!(analiseExec as any).oportunidade_instaurar?.elegivel,
          oportunidade_tipo_credito: (analiseExec as any).oportunidade_instaurar?.tipo_credito || null,
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
      let djenRes =
        mode === 'both'
          ? preDjen
          : await fetchDjenComunicacoes(protoSafe || protocolo, {
              dataInicio: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000)
                .toISOString()
                .split('T')[0],
            });
      if ((!djenRes || djenRes.success === false) && mode === 'djen') {
        await new Promise((r) => setTimeout(r, 900));
        djenRes = await fetchDjenComunicacoes(protoSafe || protocolo, {
          dataInicio: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000)
            .toISOString()
            .split('T')[0],
        });
      }
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
          djen_ultimo_link:
            djenSync.link ||
            resolveDjenPublicacaoLink(comunicacoes[0], protoSafe || protocolo) ||
            target.djen_ultimo_link ||
            null,
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


  // Ultima chance sequencial se ainda vazio (Sugerir resposta) — attempt=2 fura o cache
  if (mode === 'both' && movimentos.length === 0 && comunicacoes.length === 0) {
    try {
      const dj = await fetchDataJud(protoSafe || protocolo, 2, { fast: false });
      if (dj && !dj.error && Array.isArray(dj.movimentos) && dj.movimentos.length) {
        datajudOk = true;
        movimentos = normalizeMovimentosList(dj.movimentos);
      }
    } catch { /* */ }
    try {
      const dj = await fetchDjenComunicacoes(protoSafe || protocolo, {
        dataInicio: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      });
      if (dj?.success && dj.items?.length) {
        djenOk = true;
        comunicacoes = dj.items;
      }
    } catch { /* */ }
  }

    if (!datajudOk && !djenOk) {
    // Soft-fail: UI ainda abre; mostra toast. Nao derruba como 500.
    return {
      success: true,
      offline: true,
      error:
        'OFFLINE: DataJud e DJEN sem retorno (rede, 403 geo, rate limit ou CNJ). Confira deploy em gru1 e tente de novo.',
      case: target,
      casePatch: {
        djen_consultado_em: new Date().toISOString(),
      },
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


  // Reanálise executiva com textos DJEN (completa art.523 / procedência só no diário)
  try {
    if (movimentos.length || (comunicacoes && comunicacoes.length)) {
      const djenTextos = (comunicacoes || [])
        .slice(0, 40)
        .map((c: any) => {
          const raw = String(c.texto || c.conteudo || c.resumo || c.teor || '');
          // HTML entities comuns no DJEN
          return raw
            .replace(/&nbsp;/gi, ' ')
            .replace(/&ndash;/gi, '–')
            .replace(/&mdash;/gi, '—')
            .replace(/&sect;/gi, '§')
            .replace(/&aacute;/gi, 'á')
            .replace(/&eacute;/gi, 'é')
            .replace(/&iacute;/gi, 'í')
            .replace(/&oacute;/gi, 'ó')
            .replace(/&uacute;/gi, 'ú')
            .replace(/&atilde;/gi, 'ã')
            .replace(/&otilde;/gi, 'õ')
            .replace(/&ccedil;/gi, 'ç')
            .replace(/&Aacute;/gi, 'Á')
            .replace(/&Eacute;/gi, 'É')
            .replace(/&Ccedil;/gi, 'Ç')
            .replace(/&quot;/gi, '"')
            .replace(/&#\d+;/g, ' ')
            .replace(/<[^>]+>/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
        })
        .filter(Boolean);
      const classeCod =
        patch.detalhes_execucao?.classeCodigo ??
        (typeof target.detalhes_execucao === 'object'
          ? target.detalhes_execucao?.classeCodigo
          : null);
      const analise2 = analisarProcedenciaECumprimento(
        movimentos,
        classeCod ?? null,
        patch.datajud_ultimo_nome || target.datajud_ultimo_nome || null,
        djenTextos
      );
      if (analise2.is_procedente) patch.is_procedente = true;
      if (analise2.em_cumprimento_sentenca || analise2.cumprimento_encerrado) {
        patch.em_cumprimento_sentenca = true;
      }
      patch.cumprimento_ativo = !!analise2.cumprimento_ativo;
      patch.cumprimento_encerrado = !!analise2.cumprimento_encerrado;
      patch.status_executivo = analise2.status_executivo || patch.status_executivo;
      if ((analise2 as any).oportunidade_instaurar) {
        const op = (analise2 as any).oportunidade_instaurar;
        patch.oportunidade_instaurar = op;
        patch.oportunidade_score = op.score;
        patch.oportunidade_elegivel = !!op.elegivel;
        patch.oportunidade_tipo_credito = op.tipo_credito;
        patch.texto_pobre = !!op.texto_pobre;
        patch.precisa_enriquecer_teor = !!op.precisa_enriquecer_teor;
      }
      if (analise2.cumprimento_pendente_necessario) {
        patch.cumprimento_pendente_necessario = true;
      }
      // se cumprimento ativo/encerrado, não é "pendente instaurar"
      if (analise2.em_cumprimento_sentenca || analise2.cumprimento_encerrado) {
        patch.cumprimento_pendente_necessario = false;
      }
      if (analise2.data_transito_julgado) {
        patch.data_transito_julgado = analise2.data_transito_julgado;
      }
      patch.detalhes_execucao = {
        ...(patch.detalhes_execucao || {}),
        ...analise2.detalhes_execucao,
        oportunidade_instaurar: (analise2 as any).oportunidade_instaurar || null,
        merito_tipo: analise2.merito_tipo,
        scanned_at: new Date().toISOString(),
      };
      if (analise2.procedente_motivo) {
        patch.procedente_motivo = analise2.procedente_motivo;
      }

      // Lote5: se ainda "teor fraco", amplia DJEN (2 anos) + DataJud e reanalisa 1x
      const precisaTeor =
        !!patch.texto_pobre ||
        !!patch.precisa_enriquecer_teor ||
        !!(analise2 as any).oportunidade_instaurar?.texto_pobre ||
        !!(analise2 as any).oportunidade_instaurar?.precisa_enriquecer_teor;
      if (precisaTeor && (mode === 'both' || mode === 'djen' || mode === 'datajud')) {
        try {
          const wideStart = new Date(Date.now() - 730 * 24 * 60 * 60 * 1000)
            .toISOString()
            .split('T')[0];
          let movs2 = movimentos;
          let djen2 = comunicacoes || [];
          if (mode !== 'djen') {
            try {
              const dj2 = await fetchDataJud(protoSafe || protocolo, 3, { fast: false });
              if (dj2 && !dj2.error && Array.isArray(dj2.movimentos) && dj2.movimentos.length) {
                movs2 = normalizeMovimentosList(dj2.movimentos);
                movimentos = movs2;
                datajudOk = true;
              }
            } catch { /* */ }
          }
          if (mode !== 'datajud') {
            try {
              const djr = await fetchDjenComunicacoes(protoSafe || protocolo, {
                dataInicio: wideStart,
              });
              if (djr?.success && Array.isArray(djr.items) && djr.items.length) {
                djen2 = djr.items;
                comunicacoes = djen2;
                djenOk = true;
              }
            } catch { /* */ }
          }
          const djenTextos2 = (djen2 || [])
            .slice(0, 80)
            .map((c: any) =>
              String(c.texto || c.conteudo || c.resumo || c.teor || '')
                .replace(/<[^>]+>/g, ' ')
                .replace(/&nbsp;/gi, ' ')
                .replace(/\s+/g, ' ')
                .trim()
            )
            .filter((s: string) => s.length > 20);
          const blobLen = djenTextos2.reduce((n: number, s: string) => n + s.length, 0)
            + (movs2 || []).map((m: any) => String(m.nome || m.complemento || '')).join(' ').length;
          const analise3 = analisarProcedenciaECumprimento(
            movs2,
            classeCod ?? null,
            patch.datajud_ultimo_nome || target.datajud_ultimo_nome || null,
            djenTextos2
          );
          if (analise3.is_procedente) patch.is_procedente = true;
          if (analise3.em_cumprimento_sentenca || analise3.cumprimento_encerrado) {
            patch.em_cumprimento_sentenca = true;
            patch.cumprimento_pendente_necessario = false;
          }
          patch.cumprimento_ativo = !!analise3.cumprimento_ativo;
          patch.cumprimento_encerrado = !!analise3.cumprimento_encerrado;
          if (analise3.status_executivo) patch.status_executivo = analise3.status_executivo;
          if (analise3.cumprimento_pendente_necessario && !patch.em_cumprimento_sentenca) {
            patch.cumprimento_pendente_necessario = true;
          }
          if (analise3.data_transito_julgado) patch.data_transito_julgado = analise3.data_transito_julgado;
          if (analise3.procedente_motivo) patch.procedente_motivo = analise3.procedente_motivo;
          const op3 = (analise3 as any).oportunidade_instaurar;
          if (op3) {
            patch.oportunidade_instaurar = op3;
            patch.oportunidade_score = op3.score;
            patch.oportunidade_elegivel = !!op3.elegivel;
            patch.oportunidade_tipo_credito = op3.tipo_credito;
            patch.texto_pobre = !!op3.texto_pobre;
            patch.precisa_enriquecer_teor = !!op3.precisa_enriquecer_teor;
          } else {
            patch.texto_pobre = false;
            patch.precisa_enriquecer_teor = false;
          }
          patch.teor_enriquecido_em = new Date().toISOString();
          patch.teor_blob_chars = blobLen;
          try {
            const blobCred = djenTextos2.join('\n') + ' ' + (movs2 || []).map((m: any) => String(m.nome || '')).join(' ');
            const cred = extrairCreditoSentenca(blobCred, {
              isProcedente: !!patch.is_procedente || !!target.is_procedente,
            });
            patch.credito_sentenca = cred;
            patch.honorarios_a_receber = !!cred.honorariosAReceber;
            patch.honorarios_nivel = cred.honorariosNivel;
            patch.honorarios_confianca = cred.honorariosConfianca;
            patch.detalhes_execucao = {
              ...(patch.detalhes_execucao || {}),
              credito_sentenca: cred,
              honorarios_a_receber: !!cred.honorariosAReceber,
              honorarios_nivel: cred.honorariosNivel,
            };
          } catch { /* */ }
          // se blob grande e ainda "pobre", não é falha de índice — é ausência de quantia/sucumbência
          if (blobLen >= 800 && patch.texto_pobre) {
            patch.precisa_enriquecer_teor = false;
            patch.teor_indice_ok = true;
            patch.teor_sem_credito_detectavel = true;
          } else if (!patch.texto_pobre) {
            patch.precisa_enriquecer_teor = false;
            patch.teor_indice_ok = true;
            patch.teor_sem_credito_detectavel = false;
          }
          patch.detalhes_execucao = {
            ...(patch.detalhes_execucao || {}),
            ...analise3.detalhes_execucao,
            oportunidade_instaurar: op3 || null,
            merito_tipo: analise3.merito_tipo,
            teor_enriquecido_em: patch.teor_enriquecido_em,
            teor_blob_chars: blobLen,
            scanned_at: new Date().toISOString(),
          };
          console.info('[scan-teor-auto]', protocolo, 'blob', blobLen, 'pobre', !!patch.texto_pobre);
        } catch (e2: any) {
          console.warn('[scan-teor-auto] skip', e2?.message || e2);
        }
      }
    }
  } catch (e: any) {
    console.error('[auditCaseCoreSystem] reanalise DJEN exec', e?.message || e);
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
  } else if (patch.cumprimento_pendente_necessario || target.cumprimento_pendente_necessario) {
    patch.scan_priority = 85;
  } else if (patch.em_cumprimento_sentenca || target.em_cumprimento_sentenca) {
    patch.scan_priority = 70;
  } else if (patch.is_procedente || target.is_procedente) {
    patch.scan_priority = 65;
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

  // Lote: auto-encerrar seguro OU prioridade na fila de contato / revisar encerrados
  try {
    const decisao = decidirEncerramentoScan({ target, patch });
    patch = aplicarDecisaoNoPatch(patch, target, decisao);
    if (decisao.acao === 'auto_encerrar') {
      console.info('[scan-auto-encerrar]', protocolo, decisao.motivo);
    } else if (decisao.acao === 'revisao_fila') {
      console.info('[scan-revisao-fila]', protocolo, decisao.motivo, decisao.prioridade);
    }
  } catch (e: any) {
    console.warn('[scan-auto-encerrar] skip', e?.message || e);
  }

  // Motor parados + falta instaurar (DataJud/DJEN, worker, cron, lote)
  try {
    const { mergeMotorParadosIntoPatch } = await import('@/lib/motor-parados-instaurar');
    patch = mergeMotorParadosIntoPatch(target, patch);
  } catch (e: any) {
    console.warn('[motor-parados-instaurar] skip', e?.message || e);
  }

  // Lote3: reconcilia pendente vs já em cumprimento antes de gravar
  try {
    patch = applyReconciliacaoAoPatch(patch, target as any);
  } catch (e: any) {
    console.warn('[reconciliar-cumprimento] skip', e?.message || e);
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


  // Log visível: auto-encerrar / revisão
  try {
    if (patch.via_scan_auto_encerrar || patch.dados?.via_scan_auto_encerrar) {
      await logAlertEvent({
        empresaId,
        protocolo: protoSafe || protocolo,
        eventType: 'scan_auto_encerrar',
        source: 'scanner',
        payload: {
          motivo: patch.scan_auto_encerrar_motivo || patch.dados?.scan_auto_encerrar_motivo,
          por: 'W1 CONTROL',
          legenda: 'Feito por Davi Alves Figueredo · scanner automático',
          quando: patch.scan_auto_encerrado_em || new Date().toISOString(),
        },
      });
    } else if (patch.precisa_revisar_encerramento || patch.dados?.precisa_revisar_encerramento) {
      await logAlertEvent({
        empresaId,
        protocolo: protoSafe || protocolo,
        eventType: 'scan_revisao_encerrar',
        source: 'scanner',
        payload: {
          motivo: patch.dados?.scan_revisao_motivo || patch.evento_resumo,
          prioridade: patch.prioridade_revisao_encerrado,
        },
      });
    }
  } catch { /* não bloqueia */ }

  try {
    await logAlertEvent({
      empresaId,
      protocolo: protoSafe || protocolo,
      eventType: 'persisted',
      source: mode,
      payload: {
        datajudOk,
        djenOk,
        movCount: movimentos.length,
        djenCount: comunicacoes.length,
        djenLink: patch.djen_ultimo_link || null,
        evento_tipo: patch.evento_tipo || eventTipo,
        offline: !datajudOk && !djenOk,
      },
    });
    if (datajudOk) {
      await logScanMetric({ empresaId, source: 'datajud', success: true, protocolo: protoSafe || protocolo });
    }
    if (djenOk) {
      await logScanMetric({ empresaId, source: 'djen', success: true, protocolo: protoSafe || protocolo });
    }
    console.info(
      '[audit-detail]',
      JSON.stringify({
        protocolo: protoSafe || protocolo,
        mode,
        datajudOk,
        djenOk,
        mov: movimentos.length,
        djen: comunicacoes.length,
        link: patch.djen_ultimo_link || null,
      })
    );
  } catch (e) {
    console.error('[audit-detail] log fail', e);
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
  const ctx = await getUserContext();
  const { empresa_id } = ctx;
  if ((ctx as any).isViewer || String(ctx.cargo || '').toLowerCase().includes('visualiz')) {
    return {
      success: false,
      error: 'Modo visualização: scanner tribunal bloqueado neste perfil.',
      movimentos: [],
      comunicacoes: [],
    };
  }
  if (!empresa_id) return { success: false, error: '401', movimentos: [], comunicacoes: [] };
  const safeEmpresaId = String(empresa_id);
  // UI pontual: NUNCA fast por padrão — evita "Auditoria indisponível" falso
  const useFast = options.fast === true;
  let res = await auditCaseCoreSystem(
    protocolo,
    safeEmpresaId,
    options.mode || 'both',
    { fast: useFast, useClaudeAi: options.useClaudeAi === true }
  );
  const mov = Array.isArray((res as any)?.movimentos) ? (res as any).movimentos : [];
  const com = Array.isArray((res as any)?.comunicacoes) ? (res as any).comunicacoes : [];
  // 2ª tentativa sem fast se veio vazio (timeout/rate)
  if ((!mov.length && !com.length) && useFast) {
    res = await auditCaseCoreSystem(
      protocolo,
      safeEmpresaId,
      options.mode || 'both',
      { fast: false, useClaudeAi: options.useClaudeAi === true }
    );
  }
  const mov2 = Array.isArray((res as any)?.movimentos) ? (res as any).movimentos : [];
  const com2 = Array.isArray((res as any)?.comunicacoes) ? (res as any).comunicacoes : [];
  if (!mov2.length && !com2.length) {
    return {
      ...res,
      success: true,
      offline: true,
      movimentos: [],
      comunicacoes: [],
      error:
        (res as any)?.error ||
        'Sem movimentos DataJud/DJEN. Possíveis causas: timeout, 403 geográfico, CNJ fora do índice ou rede. Tente novamente em alguns segundos.',
      message:
        (res as any)?.message ||
        'Cronologia vazia — não significa ausência de andamento no tribunal.',
    };
  }
  return {
    ...res,
    movimentos: mov2,
    comunicacoes: com2,
  };
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
    const { getGlobalPendingProcessesSystem } = await import('@/lib/server-db');
    const LIMIT = 20;
    const RE_SCAN_MS = 6 * 60 * 60 * 1000;
    const candidates = await getGlobalPendingProcessesSystem(LIMIT * 3, empresaId);
    const targetCases = (candidates || []).filter((c: any) => {
      if (isCasoEncerrado(c)) return false;
      const lastScan = c.datajud_consultado_em || c.djen_consultado_em || null;
      if (!lastScan) return true;
      try {
        return new Date(lastScan).getTime() < Date.now() - RE_SCAN_MS;
      } catch {
        return true;
      }
    }).slice(0, LIMIT);
    let updated = 0;
    let failed = 0;
    for (const c of targetCases) {
      try {
        const res = await auditCaseCoreSystem(c.protocolo, empresaId, 'both', { fast: true });
        const p = (res.casePatch as Record<string, any>) || {};
        if (res.success && (p.tem_atualizacao_pos_retorno || p.djen_nova_comunicacao)) updated++;
        if (!res.success) failed++;
      } catch {
        failed++;
      }
    }
    return {
      success: true,
      scanned: targetCases.length,
      updated,
      failed,
      skipped: Math.max(0, (candidates || []).length - targetCases.length),
    };
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

/**
 * Registra quem atendeu/registrou retorno de cada processo (auditoria).
 * Chamado após salvar atendimento para contabilizar no ranking da semana.
 */

/**
 * Atendimento unificado (Tarefas / Processos / WhatsApp).
 * Grava ultimo_retorno = hoje (Brasília YYYY-MM-DD) + auditoria.
 * Assim KPI e fila batem em todas as abas.
 */
export async function registrarAtendimentoCompletoAction(input: {
  protocolo: string;
  situacao?: string;
  observacao?: string | null;
  proximoPrazo?: string | null;
  via?: string;
  filaLista?: string;
}) {
  try {
    const { getUserContext, getStoredCases, getStoredCasesForEmpresa, getSupabaseAdmin } = await import('@/lib/server-db');
    const { processarCaso, formatDateToISO } = await import('@/lib/case-logic');
    const { hojeBrasilYmd } = await import('@/lib/atendimento-semana');
    const { patchAtendimentoComEdicao } = await import('@/lib/processos-auditados');
    const { applyFilaListaToObs } = await import('@/lib/fila-listas');
    const { saveOneCaseAction } = await import('@/app/actions/case-save-actions');

    const { auth_id, empresa_id, isMasterView } = await getUserContext();
    if (!empresa_id || !input.protocolo) {
      return { success: false, message: 'Sessão ou protocolo inválido' };
    }

    const digits = String(input.protocolo).replace(/\D/g, '');
    // Busca soberana por empresa + CNJ (não depende de created_by / filtro de carteira pessoal)
    let found: any = null;
    try {
      const admin = await getSupabaseAdmin();
      if (admin && digits.length >= 15) {
        // tenta match exato em protocolo_ref (evita varrer 3000 e perder o CNJ)
        let hit: any = null;
        const { data: exact } = await admin
          .from('processos')
          .select('*')
          .eq('empresa_id', empresa_id)
          .eq('protocolo_ref', String(input.protocolo).trim())
          .limit(1);
        hit = exact?.[0] || null;
        if (!hit) {
          const { data: rows } = await admin
            .from('processos')
            .select('*')
            .eq('empresa_id', empresa_id)
            .limit(5000);
          hit = (rows || []).find((r: any) => {
            const ref = String(r.protocolo_ref || r.dados?.protocolo || '').replace(/\D/g, '');
            return ref === digits || (ref.length >= 15 && (ref.endsWith(digits) || digits.endsWith(ref)));
          });
        }
        if (hit) {
          const { processarCaso: pc } = await import('@/lib/case-logic');
          const dados = hit.dados && typeof hit.dados === 'object' ? hit.dados : {};
          found = pc({
            ...dados,
            id: String(hit.id),
            db_id: String(hit.id),
            created_by: hit.created_by,
            protocolo: (String(hit.protocolo_ref || '').replace(/\D/g, '').length >= 15 ? hit.protocolo_ref : null) || (String(dados.protocolo || '').replace(/\D/g, '').length >= 15 ? dados.protocolo : null) || hit.protocolo_ref || dados.protocolo || input.protocolo,
            advogado: hit.advogado ?? dados.advogado,
            escritorio: hit.escritorio ?? dados.escritorio,
            status: hit.status ?? dados.status,
            tribunal: hit.tribunal ?? dados.tribunal,
            telefone: hit.telefone ?? dados.telefone,
            observacao: hit.observacoes ?? dados.observacao,
            ultimoRetorno: hit.ultimo_retorno ?? dados.ultimoRetorno,
            proximoPrazo: hit.proximo_retorno ?? dados.proximoPrazo,
          });
        }
      }
    } catch { /* fallback abaixo */ }

    if (!found) {
      const all = await getStoredCasesForEmpresa(empresa_id, true);
      found = (all || []).find(
        (c: any) => String(c.protocolo || '').replace(/\D/g, '') === digits
      );
    }
    if (!found) {
      return { success: false, message: 'Processo não encontrado na carteira' };
    }

    const hoje = hojeBrasilYmd();
    const situacao =
      input.situacao === 'ENCERRADO' ? 'ENCERRADO' : (found.situacao || 'EM ANDAMENTO');
    const obs = applyFilaListaToObs(
      input.observacao != null ? String(input.observacao) : found.observacao || '',
      (input.filaLista as any) || 'normal'
    );

    const patch = patchAtendimentoComEdicao(auth_id, hoje);
    // Quem atendeu: registra, SEM mudar created_by (dono da carteira)
    const ownerKeep = (found as any).created_by || null;
    const prazoNovo =
      situacao === 'ENCERRADO'
        ? ''
        : input.proximoPrazo != null
          ? input.proximoPrazo
          : found.proximoPrazo;
    const updated = processarCaso({
      ...found,
      ...patch,
      situacao,
      observacao: obs,
      statusManual: situacao === 'ENCERRADO' ? 'Encerrado' : 'Automatico',
      proximoPrazo: prazoNovo,
      tem_novo_andamento: false,
      djen_nova_comunicacao: false,
      tem_atualizacao_pos_retorno: false,
      datajud_encerrado_tribunal:
        situacao === 'ENCERRADO' ? true : found.datajud_encerrado_tribunal,
    });

    (updated as any).created_by = ownerKeep;
    (updated as any).atendido_por = auth_id;
    const saved = await saveOneCaseAction(updated as any);
    if (!saved.success) {
      return { success: false, message: saved.message || 'Falha ao salvar' };
    }

    await registrarAtendimentoAction([found.protocolo], {
      situacao,
      via: input.via || 'unificado',
      ultimoRetorno: hoje,
      observacao: obs || null,
    });

    if (situacao === 'ENCERRADO') {
      await registrarAuditoriaEventAction('encerramento', [found.protocolo], {
        via: input.via || 'unificado',
        encerrado_em: hoje,
        por: auth_id,
      });
    }

    return {
      success: true,
      message: 'Atendimento registrado',
      case: saved.case || updated,
      ultimoRetorno: hoje,
    };
  } catch (e: any) {
    return { success: false, message: e?.message || 'Erro no atendimento' };
  }
}

export async function registrarAtendimentoAction(
  protocolos: string[],
  detalhes: Record<string, any> = {}
) {
  const { registrarAuditoriaAction } = await import('@/lib/server-db');
  return registrarAuditoriaAction('atendimento', protocolos, detalhes);
}

/** Registra evento de auditoria genérico (edição / exclusão / criação). */
export async function registrarAuditoriaEventAction(
  acao: 'atendimento' | 'edicao' | 'exclusao' | 'criacao' | 'encerramento',
  protocolos: string[],
  detalhes: Record<string, any> = {}
) {
  const { registrarAuditoriaAction } = await import('@/lib/server-db');
  return registrarAuditoriaAction(acao, protocolos, detalhes);
}

/**
 * Visão da empresa inteira (todos os perfis): todos os processos da empresa
 * + trilha de auditoria (quem atendeu/editou/apagou) + usuários.
 */
export async function fetchCompanyProcessosAction() {
  const {
    getStoredCasesPageForEmpresa,
    getUserContext,
    fetchAuditoriaLogsAction,
    getEmpresaUsers,
  } = await import("@/lib/server-db");

  const empty = {
    cases: [] as any[],
    audit: [] as any[],
    users: [] as any[],
    totalCount: 0,
    ativosCount: 0,
    atendidosSemana: 0,
    ranking: [] as any[],
    error: null as string | null,
  };

  try {
    const ctx = await getUserContext();
    const empresa_id = ctx.empresa_id;
    if (!empresa_id) return empty;

    // 1) Métricas leves + 2) 1ª página da lista + 3) audit/users — em paralelo
    const { fetchRankingAtendentesEmpresaAction } = await import(
      "@/app/actions/ranking-atendentes-action"
    );

    const [metrics, casesPage, audit, users] = await Promise.all([
      fetchRankingAtendentesEmpresaAction(5).catch((e: any) => {
        console.error("[company] metrics", e?.message);
        return { ok: false as const, ranking: [], total: 0, ativos: 0, atendidosSemana: 0 };
      }),
      // 1ª página — 300 linhas (tabela); total vem do COUNT
      getStoredCasesPageForEmpresa(empresa_id, 500, 0, true, { onlyAtivos: true }).catch((e: any) => {
        console.error("[company] page ativos", e?.message);
        return [] as any[];
      }),
      fetchAuditoriaLogsAction(empresa_id).catch(() => []),
      getEmpresaUsers().catch(() => []),
    ]);

    const cases = Array.isArray(casesPage) ? casesPage : [];
    const totalCount =
      metrics && typeof (metrics as any).total === "number" && (metrics as any).total > 0
        ? (metrics as any).total
        : cases.length;
    const ativosCount =
      metrics && typeof (metrics as any).ativos === "number"
        ? (metrics as any).ativos
        : 0;
    const atendidosSemana =
      metrics && typeof (metrics as any).atendidosSemana === "number"
        ? (metrics as any).atendidosSemana
        : 0;
    const ranking =
      metrics && (metrics as any).ok && Array.isArray((metrics as any).ranking)
        ? (metrics as any).ranking
        : [];

    return {
      cases,
      audit: Array.isArray(audit) ? audit : [],
      users: Array.isArray(users) ? users : [],
      totalCount,
      ativosCount,
      atendidosSemana,
      ranking,
      error: null,
    };
  } catch (e: any) {
    console.error("[fetchCompanyProcessosAction] fatal", e?.message);
    return { ...empty, error: e?.message || "falha" };
  }
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

/**
 * Corrige processos ENCERRADOS hoje cuja coluna ultimo_retorno NÃO foi atualizada.
 * Só mexe em quem tem updated_at no dia de Brasília (ou situacao ENCERRADO sem retorno na semana).
 * Não reescreve a carteira inteira antiga.
 */
export async function backfillEncerradosHojeAction(): Promise<{
  success: boolean;
  updated: number;
  message?: string;
}> {
  try {
    const { getUserContext, getSupabaseAdmin, getStoredCasesForEmpresa, saveStoredCasesForEmpresa } = await import('@/lib/server-db');
    const { processarCaso } = await import('@/lib/case-logic');
    const { hojeBrasilYmd, isAtendidoNestaSemana, parseUltimoAtendimento } = await import('@/lib/atendimento-semana');
    const ctx = await getUserContext();
    if (!ctx.empresa_id) return { success: false, updated: 0, message: 'Sessão expirada' };

    const hoje = hojeBrasilYmd();
    const admin = await getSupabaseAdmin();

    // Linhas tocadas hoje (updated_at) — candidatos a "encerrado hoje sem retorno"
    const startIso = `${hoje}T00:00:00-03:00`;
    const { data: rows, error } = await admin
      .from('processos')
      .select('id, protocolo_ref, status, ultimo_retorno, updated_at, dados')
      .eq('empresa_id', ctx.empresa_id)
      .gte('updated_at', startIso);

    if (error) {
      // fallback sem filtro de updated_at: usa carteira em memória
      const cases = await getStoredCasesForEmpresa(ctx.empresa_id, true);
      let n = 0;
      const next = cases.map((c: any) => {
        const sit = String(c.situacao || c.status || '').toUpperCase();
        const enc =
          sit.includes('ENCERR') ||
          sit.includes('ARQUIV') ||
          !!c.datajud_encerrado_tribunal;
        if (!enc) return c;
        if (isAtendidoNestaSemana(c.ultimoRetorno || c.ultimo_retorno)) return c;
        n += 1;
        return processarCaso({
          ...c,
          situacao: c.situacao || 'ENCERRADO',
          ultimoRetorno: hoje,
          proximoPrazo: '',
        });
      });
      // Só salva se poucos (evita marcar 500 antigos). Limite: 80.
      if (n === 0) return { success: true, updated: 0, message: 'Nada a corrigir' };
      if (n > 80) {
        return {
          success: false,
          updated: 0,
          message: `Há ${n} encerrados sem retorno recente — rode de novo com updated_at ou corrija manualmente.`,
        };
      }
      const res = await saveStoredCasesForEmpresa(next, ctx.empresa_id, true);
      if (res.success && n > 0) {
        try {
          const corrigidos = next
            .filter((c: any) => String(c.ultimoRetorno || '') === hoje)
            .map((c: any) => String(c.protocolo || '').replace(/\D/g, ''))
            .filter(Boolean);
          if (corrigidos.length) {
            await registrarAuditoriaEventAction('encerramento', corrigidos, {
              via: 'backfillEncerradosHoje',
              por: 'sistema',
              data: hoje,
            });
          }
        } catch { /* */ }
      }
      return { success: !!res.success, updated: n, message: res.message };
    }

    const touched = rows || [];
    if (!touched.length) return { success: true, updated: 0, message: 'Nenhuma linha atualizada hoje' };

    const cases = await getStoredCasesForEmpresa(ctx.empresa_id, true);
    const byProt = new Map(cases.map((c: any) => [String(c.protocolo || '').replace(/\D/g, ''), c]));
    let n = 0;
    const next = cases.map((c: any) => {
      const dig = String(c.protocolo || '').replace(/\D/g, '');
      const row = touched.find((r: any) => String(r.protocolo_ref || '').replace(/\D/g, '') === dig);
      if (!row) return c;
      const sit = String(
        (row.dados && (row.dados.situacao || row.dados.SITUACAO)) ||
          c.situacao ||
          row.status ||
          c.status ||
          ''
      ).toUpperCase();
      const enc =
        sit.includes('ENCERR') ||
        sit.includes('ARQUIV') ||
        String(row.status || '').toUpperCase().includes('ENCERR') ||
        !!c.datajud_encerrado_tribunal;
      if (!enc) return c;
      if (isAtendidoNestaSemana(row.ultimo_retorno || c.ultimoRetorno)) return c;
      n += 1;
      return processarCaso({
        ...c,
        situacao: c.situacao || 'ENCERRADO',
        ultimoRetorno: hoje,
        proximoPrazo: '',
        tem_novo_andamento: false,
        tem_atualizacao_pos_retorno: false,
      });
    });

    if (n === 0) return { success: true, updated: 0, message: 'Já contabilizados' };
    const res = await saveStoredCasesForEmpresa(next, ctx.empresa_id, true);
    if (res.success && n > 0) {
      try {
        const corrigidos = next
          .filter((c: any) => String(c.ultimoRetorno || '') === hoje)
          .map((c: any) => String(c.protocolo || '').replace(/\D/g, ''))
          .filter(Boolean);
        if (corrigidos.length) {
          await registrarAuditoriaEventAction('encerramento', corrigidos, {
            via: 'backfillEncerradosHoje',
            por: 'sistema',
            data: hoje,
          });
        }
      } catch { /* */ }
    }
    return {
      success: !!res.success,
      updated: n,
      message: res.success ? `${n} encerrado(s) de hoje passaram a contar como atendimento` : res.message,
    };
  } catch (e: any) {
    return { success: false, updated: 0, message: e?.message || 'Falha no backfill' };
  }
}

/**
 * Busca exclusiva para a aba "Ações Procedentes e Cumprimentos".
 * Retorna apenas processos com is_procedente, em_cumprimento_sentenca ou cumprimento_pendente_necessario.
 */
export async function getCumprimentosEProcedentesAction() {
  const { empresa_id } = await getUserContext();
  if (!empresa_id) return { success: false, data: [] as LegalCase[] };

  try {
    const all = await getStoredCasesForEmpresa(empresa_id);
    const filtered = all.filter((c: any) => {
      const dados = (c.dados && typeof c.dados === 'object' ? c.dados : {}) as any;
      const st =
        c.status_executivo ||
        dados.status_executivo ||
        c.detalhes_execucao?.status_executivo ||
        dados.detalhes_execucao?.status_executivo;
      return (
        c.is_procedente ||
        dados.is_procedente ||
        c.em_cumprimento_sentenca ||
        dados.em_cumprimento_sentenca ||
        c.cumprimento_pendente_necessario ||
        dados.cumprimento_pendente_necessario ||
        c.cumprimento_encerrado ||
        dados.cumprimento_encerrado ||
        c.cumprimento_ativo ||
        dados.cumprimento_ativo ||
        st === 'pendente' ||
        st === 'ativo' ||
        st === 'encerrado' ||
        st === 'procedente' ||
        c.evento_tipo === 'sentenca_procedente' ||
        c.evento_tipo === 'sentenca_parcial' ||
        c.evento_tipo === 'cumprimento_sentenca' ||
        c.oportunidade_elegivel ||
        dados.oportunidade_elegivel ||
        c.detalhes_execucao?.oportunidade_instaurar?.elegivel ||
        dados.detalhes_execucao?.oportunidade_instaurar?.elegivel ||
        // telemetria textual (antes da reclassificação formal)
        /CUMPRIMENTO DE SENTEN[CÇ]A|FASE DE CUMPRIMENTO/i.test(
          `${c.datajud_ultimo_nome || ''} ${c.djen_ultimo_resumo || ''} ${dados.datajud_ultimo_nome || ''}`
        )
      );
    });

    // Anti-duplicata por CNJ/protocolo (mantém o mais completo)
    const byProto = new Map<string, any>();
    for (const c of filtered) {
      const key = String(c.protocolo || (c as any).protocolo_ref || c.id || '')
        .replace(/\D/g, '')
        .slice(-20);
      if (!key) continue;
      const prev = byProto.get(key);
      if (!prev) {
        byProto.set(key, c);
        continue;
      }
      const score = (x: any) =>
        (x.cumprimento_pendente_necessario ? 4 : 0) +
        (x.em_cumprimento_sentenca ? 3 : 0) +
        (x.is_procedente ? 2 : 0) +
        (x.cumprimento_encerrado ? 1 : 0);
      if (score(c) >= score(prev)) byProto.set(key, c);
    }
    const unique = Array.from(byProto.values());

    unique.sort((a: any, b: any) => {
      const rank = (x: any) => {
        const st = x.status_executivo || x.detalhes_execucao?.status_executivo;
        if (x.cumprimento_pendente_necessario || st === 'pendente') return 0;
        if (x.cumprimento_ativo || st === 'ativo') return 1;
        if (x.is_procedente || st === 'procedente') return 2;
        if (x.cumprimento_encerrado || st === 'encerrado') return 3;
        return 4;
      };
      const d = rank(a) - rank(b);
      if (d !== 0) return d;
      return String(a.data_transito_julgado || '').localeCompare(
        String(b.data_transito_julgado || '')
      );
    });
    return { success: true, data: unique };
  } catch (e: any) {
    return { success: false, data: [] as LegalCase[] };
  }
}

/**
 * Enriquece um caso com flags de procedência/cumprimento via scan DataJud.
 * Chamado pelo scanner automático ou manualmente pela aba.
 */
export async function enriquecerProcedenciaAction(protocolo: string) {
  const { empresa_id } = await getUserContext();
  if (!empresa_id) return { success: false };

  try {
    // Lote5: BOTH + fast:false — DJEN carrega teor da sentença (DataJud sozinho = texto pobre)
    const res = await auditCaseCoreSystem(protocolo, empresa_id, 'both', {
      fast: false,
    });
    if (!res || (res as any).success === false) {
      return { success: false, error: (res as any)?.error || 'Falha na auditoria' };
    }
    const patch = (res as any).casePatch || {};
    return {
      success: true,
      is_procedente: !!patch.is_procedente,
      em_cumprimento_sentenca: !!patch.em_cumprimento_sentenca,
      cumprimento_pendente_necessario: !!patch.cumprimento_pendente_necessario,
      texto_pobre: !!patch.texto_pobre,
      precisa_enriquecer_teor: !!patch.precisa_enriquecer_teor,
      teor_enriquecido_em: patch.teor_enriquecido_em || null,
      teor_blob_chars: patch.teor_blob_chars || null,
      oportunidade_score: patch.oportunidade_score ?? null,
      status_executivo: patch.status_executivo || null,
      casePatch: patch,
    };
  } catch (e: any) {
    return { success: false, error: e?.message };
  }
}


/**
 * Reclassifica a carteira inteira OFFLINE (sem DataJud).
 * Usa movimentos salvos / último nome / resumos DJEN já no banco.
 * Rápido — ideal antes de exportar ou para popular a aba.
 */
export async function reclassificarExecutivoCarteiraAction() {
  const { empresa_id } = await getUserContext();
  if (!empresa_id) return { success: false, updated: 0, error: 'Sem sessão' };

  try {
    const { analisarProcedenciaECumprimento } = await import('@/lib/datajud-sync');
    const admin = await getSupabaseAdmin();

    let page = 0;
    const pageSize = 500;
    let updated = 0;
    let scanned = 0;
    let hits = 0;

    while (true) {
      const { data: rows, error } = await admin
        .from('processos')
        .select(
          'id, protocolo_ref, dados, datajud_ultimo_nome, datajud_encerrado_motivo, cumprimento_sentenca_motivo, djen_ultimo_resumo, em_cumprimento_sentenca, is_procedente, cumprimento_pendente_necessario, data_transito_julgado'
        )
        .eq('empresa_id', empresa_id)
        .range(page * pageSize, page * pageSize + pageSize - 1);

      if (error) throw new Error(error.message);
      if (!rows?.length) break;

      for (const row of rows) {
        scanned += 1;
        const dados = (row.dados && typeof row.dados === 'object' ? row.dados : {}) as any;
        const movimentos =
          Array.isArray(dados.movimentos) && dados.movimentos.length
            ? dados.movimentos
            : Array.isArray(dados.datajud_movimentos)
              ? dados.datajud_movimentos
              : [];

        // Pseudo-movimento a partir de colunas já gravadas
        const nomes = [
          row.datajud_ultimo_nome,
          row.cumprimento_sentenca_motivo,
          row.datajud_encerrado_motivo,
          dados.evento_resumo,
          dados.datajud_ultimo_nome,
        ].filter(Boolean);
        const pseudo = nomes.map((n: string) => ({ nome: String(n), dataHora: null }));
        const movs = movimentos.length ? movimentos : pseudo;

        const classeCodigo =
          dados.classeCodigo ??
          dados.classe_codigo ??
          dados.classe?.codigo ??
          null;

        const djenTextos = [
          row.djen_ultimo_resumo,
          dados.djen_ultimo_resumo,
          ...(Array.isArray(dados.djen_textos) ? dados.djen_textos : []),
        ].filter(Boolean) as string[];

        const r = analisarProcedenciaECumprimento(
          movs,
          classeCodigo != null ? Number(classeCodigo) : null,
          row.datajud_ultimo_nome || dados.datajud_ultimo_nome || null,
          djenTextos
        );

        const patch: Record<string, any> = {
          is_procedente: r.is_procedente,
          procedente_motivo: r.procedente_motivo,
          em_cumprimento_sentenca: r.em_cumprimento_sentenca,
          cumprimento_ativo: r.cumprimento_ativo,
          cumprimento_encerrado: r.cumprimento_encerrado,
          status_executivo: r.status_executivo,
          cumprimento_pendente_necessario: r.cumprimento_pendente_necessario,
          data_transito_julgado: r.data_transito_julgado || row.data_transito_julgado || null,
          detalhes_execucao: {
            ...r.detalhes_execucao,
            status_executivo: r.status_executivo,
            cumprimento_ativo: r.cumprimento_ativo,
            cumprimento_encerrado: r.cumprimento_encerrado,
            via: 'reclassificar-local',
            scanned_at: new Date().toISOString(),
          },
        };
        if (r.em_cumprimento_sentenca && r.procedente_motivo) {
          /* keep */
        }
        if (r.em_cumprimento_sentenca) {
          patch.cumprimento_sentenca_motivo =
            r.detalhes_execucao?.motivos?.[0] || row.cumprimento_sentenca_motivo || 'Cumprimento';
        }

        const changed =
          !!row.is_procedente !== r.is_procedente ||
          !!row.em_cumprimento_sentenca !== r.em_cumprimento_sentenca ||
          !!row.cumprimento_pendente_necessario !== r.cumprimento_pendente_necessario;

        // Motor parados + falta instaurar (scan local / reclass carteira)
        try {
          const { mergeMotorParadosIntoPatch } = await import('@/lib/motor-parados-instaurar');
          const targetLocal = {
            ...row,
            dados,
            protocolo: row.protocolo_ref,
            is_procedente: row.is_procedente,
            em_cumprimento_sentenca: row.em_cumprimento_sentenca,
            cumprimento_pendente_necessario: row.cumprimento_pendente_necessario,
          };
          const mergedPatch = mergeMotorParadosIntoPatch(targetLocal, { ...patch });
          Object.assign(patch, mergedPatch);
          if (mergedPatch.dados) Object.assign(patch, { dados: mergedPatch.dados });
        } catch (e: any) {
          console.warn('[motor-parados reclass]', e?.message || e);
        }

        // Lote3: resolve pendente × já em cumprimento após motor parados
        try {
          patch = applyReconciliacaoAoPatch(patch, {
            ...row,
            dados,
            cumprimento_pendente_necessario: row.cumprimento_pendente_necessario,
            em_cumprimento_sentenca: row.em_cumprimento_sentenca,
          });
        } catch (e: any) {
          console.warn('[reconciliar reclass]', e?.message || e);
        }

        // sempre grava flags atuais + merge dados
        const newDados = { ...dados, ...patch, ...(patch.dados || {}) };
        let upErr = (
          await admin
            .from('processos')
            .update({
              dados: newDados,
              is_procedente: patch.is_procedente,
              procedente_motivo: patch.procedente_motivo,
              em_cumprimento_sentenca: patch.em_cumprimento_sentenca,
              cumprimento_pendente_necessario: patch.cumprimento_pendente_necessario,
              data_transito_julgado: patch.data_transito_julgado,
              cumprimento_sentenca_motivo: patch.cumprimento_sentenca_motivo ?? row.cumprimento_sentenca_motivo,
            })
            .eq('id', row.id)
        ).error;

        // Coluna inexistente → grava só JSON dados (flags executivas)
        if (upErr && /does not exist|column/i.test(upErr.message || '')) {
          upErr = (await admin.from('processos').update({ dados: newDados, em_cumprimento_sentenca: patch.em_cumprimento_sentenca }).eq('id', row.id)).error;
        }

        if (!upErr) {
          updated += 1;
          if (
            r.is_procedente ||
            r.em_cumprimento_sentenca ||
            r.cumprimento_pendente_necessario ||
            r.cumprimento_ativo ||
            r.cumprimento_encerrado ||
            (r.status_executivo && r.status_executivo !== 'nenhum')
          ) {
            hits += 1;
          }
        }
      }

      if (rows.length < pageSize) break;
      page += 1;
    }

    return { success: true, scanned, updated, hits };
  } catch (e: any) {
    console.error('[reclassificarExecutivoCarteiraAction]', e);
    return { success: false, updated: 0, error: e?.message || 'Erro' };
  }
}

export async function batchScanExecutivoAction(opts?: {
  limit?: number;
  onlyMissing?: boolean;
  afterId?: number | null;
  /** Prioriza processos já marcados como encerrados no tribunal (falta instaurar?) */
  priorizarEncerrados?: boolean;
}) {
  const ctx = await getUserContext();
  const { empresa_id, auth_id, isMasterView, isSupervisor, isSuperAdmin, cargo } = ctx;
  if (!empresa_id) return { success: false, done: 0, error: 'Sem sessão' };

  const escopoEmpresa = !!(isSuperAdmin || isSupervisor);
  const limit = Math.min(Math.max(opts?.limit ?? 25, 1), 50);
  const onlyMissing = opts?.onlyMissing !== false;
  const priorizarEncerrados = opts?.priorizarEncerrados !== false;
  const afterId = opts?.afterId != null ? Number(opts.afterId) : 0;

  try {
    const admin = await getSupabaseAdmin();

    let countQ = admin
      .from('processos')
      .select('id', { count: 'exact', head: true })
      .eq('empresa_id', empresa_id);
    if (!escopoEmpresa && auth_id) countQ = countQ.eq('created_by', auth_id);
    const { count: totalEscopo } = await countQ;

    const pool: any[] = [];
    let cursor = afterId;
    let safety = 0;

    // Função: caso ainda precisa de análise executiva?
    const needsScan = (r: any) => {
      const dados = (r.dados && typeof r.dados === 'object' ? r.dados : {}) as any;
      const hasFlag =
        r.is_procedente ||
        r.em_cumprimento_sentenca ||
        r.cumprimento_pendente_necessario ||
        dados.is_procedente ||
        dados.em_cumprimento_sentenca ||
        dados.cumprimento_pendente_necessario ||
        dados.cumprimento_encerrado ||
        dados.cumprimento_ativo ||
        dados.status_executivo;
      // Já classificado → não reprocessa (evita “duplicar” trabalho e ruído)
      if (onlyMissing && hasFlag) return false;
      return true;
    };

    // 1) Prioridade: encerrados no tribunal sem flags executivas (pode faltar instaurar)
    if (priorizarEncerrados && pool.length < limit) {
      let qEnc = admin
        .from('processos')
        .select(
          'id, protocolo_ref, created_by, is_procedente, em_cumprimento_sentenca, cumprimento_pendente_necessario, datajud_encerrado_tribunal, dados'
        )
        .eq('empresa_id', empresa_id)
        .eq('datajud_encerrado_tribunal', true)
        .order('id', { ascending: true })
        .limit(150);
      if (!escopoEmpresa && auth_id) qEnc = qEnc.eq('created_by', auth_id);
      if (cursor > 0) qEnc = qEnc.gt('id', cursor);

      const { data: encRows } = await qEnc;
      for (const r of encRows || []) {
        if (!needsScan(r)) continue;
        pool.push(r);
        cursor = Math.max(cursor, Number(r.id) || 0);
        if (pool.length >= limit) break;
      }
    }

    // 2) Restante da carteira no escopo (sem flag ainda)
    while (pool.length < limit && safety < 40) {
      safety += 1;
      let q = admin
        .from('processos')
        .select(
          'id, protocolo_ref, created_by, is_procedente, em_cumprimento_sentenca, cumprimento_pendente_necessario, datajud_encerrado_tribunal, dados'
        )
        .eq('empresa_id', empresa_id)
        .order('id', { ascending: true })
        .limit(120);
      if (!escopoEmpresa && auth_id) q = q.eq('created_by', auth_id);
      if (cursor > 0) q = q.gt('id', cursor);

      const { data: rows, error } = await q;
      if (error) throw new Error(error.message);
      if (!rows?.length) break;

      for (const r of rows) {
        cursor = Number(r.id) || cursor;
        // já no pool?
        if (pool.some((p) => p.id === r.id || p.protocolo_ref === r.protocolo_ref)) continue;
        if (!needsScan(r)) continue;
        pool.push(r);
        if (pool.length >= limit) break;
      }
      if (rows.length < 120) break;
    }

    // Anti-duplicata de protocolo no próprio lote
    const seenProto = new Set<string>();
    const uniquePool: any[] = [];
    for (const r of pool) {
      const k = String(r.protocolo_ref || '').replace(/\D/g, '');
      if (k && seenProto.has(k)) continue;
      if (k) seenProto.add(k);
      uniquePool.push(r);
    }

    let done = 0;
    let ok = 0;
    let lastId = afterId;
    const errors: string[] = [];

    for (const row of uniquePool) {
      const proto = String(row.protocolo_ref || '');
      lastId = Number(row.id) || lastId;
      if (!proto) continue;
      try {
        // Só ATUALIZA processo já existente — auditCaseCoreSystem não cria carteira nova
        const res = await auditCaseCoreSystem(proto, empresa_id, 'both', { fast: true });
        if (res?.success) ok += 1;
        else errors.push(proto);
      } catch (e: any) {
        errors.push(`${proto}: ${e?.message || 'fail'}`);
      }
      done += 1;
      await new Promise((r) => setTimeout(r, 1100));
    }

    let moreQ = admin
      .from('processos')
      .select('id')
      .eq('empresa_id', empresa_id)
      .gt('id', lastId || 0)
      .order('id', { ascending: true })
      .limit(1);
    if (!escopoEmpresa && auth_id) moreQ = moreQ.eq('created_by', auth_id);
    const { data: moreRows } = await moreQ;
    const hasMore = !!(moreRows && moreRows.length);

    return {
      success: true,
      done,
      ok,
      lastId,
      hasMore,
      totalEscopo: totalEscopo ?? null,
      escopo: escopoEmpresa ? 'empresa' : 'usuario',
      cargo: cargo || null,
      priorizouEncerrados: priorizarEncerrados,
      remaining_hint: hasMore
        ? `Lote ok (inclui encerrados sem flag). Clique de novo (cursor>${lastId}). Escopo: ${
            escopoEmpresa ? 'empresa' : 'seus processos'
          }.`
        : `Fila concluída no escopo (${escopoEmpresa ? 'empresa' : 'usuário'}). Já classificados não foram reprocessados.`,
      errors: errors.slice(0, 8),
    };
  } catch (e: any) {
    return { success: false, done: 0, error: e?.message || 'Erro' };
  }
}

/**
 * Enriquecimento SELETIVO de teor — só fila "texto pobre" / pendente / score médio.
 * Não varre a carteira inteira. Reexecuta DataJud+DJEN (both) com janela ampla.
 * Inspirado no ROI de eSAJ/juscraper, mas só com fontes oficiais já integradas.
 */
export async function enriquecerTeorFilaOportunidadeAction(opts?: {
  limit?: number;
  onlyTextoPobre?: boolean;
}): Promise<{
  success: boolean;
  done: number;
  enriched: number;
  remaining: number;
  error?: string;
}> {
  try {
    const limit = Math.min(Math.max(opts?.limit ?? 15, 1), 40);
    const onlyPoor = opts?.onlyTextoPobre !== false;
    const res = await getCumprimentosEProcedentesAction();
    if (!res.success || !res.data?.length) {
      return { success: true, done: 0, enriched: 0, remaining: 0 };
    }

    const candidates = (res.data as any[]).filter((c) => {
      const dados = c.dados && typeof c.dados === 'object' ? c.dados : {};
      const op =
        c.oportunidade_instaurar ||
        dados.oportunidade_instaurar ||
        c.detalhes_execucao?.oportunidade_instaurar ||
        dados.detalhes_execucao?.oportunidade_instaurar;
      const textoPobre =
        !!c.texto_pobre ||
        !!dados.texto_pobre ||
        !!op?.texto_pobre ||
        !!c.precisa_enriquecer_teor ||
        !!dados.precisa_enriquecer_teor ||
        !!op?.precisa_enriquecer_teor;
      const pendente =
        c.cumprimento_pendente_necessario ||
        dados.cumprimento_pendente_necessario ||
        c.status_executivo === 'pendente' ||
        dados.status_executivo === 'pendente';
      const score = Number(c.oportunidade_score ?? op?.score ?? 0);
      const elegivel = !!(c.oportunidade_elegivel || op?.elegivel);
      // Prioridade: texto pobre; senão pendente jurídico com score baixo/médio
      if (onlyPoor) return textoPobre || (pendente && !elegivel);
      return textoPobre || pendente || (score > 0 && score < 70);
    });

    // Prioriza texto_pobre e score mais alto entre os pobres
    candidates.sort((a, b) => {
      const opA = a.oportunidade_instaurar || a.detalhes_execucao?.oportunidade_instaurar;
      const opB = b.oportunidade_instaurar || b.detalhes_execucao?.oportunidade_instaurar;
      const pA = (a.texto_pobre || opA?.texto_pobre ? 2 : 0) + Number(a.oportunidade_score ?? opA?.score ?? 0) / 100;
      const pB = (b.texto_pobre || opB?.texto_pobre ? 2 : 0) + Number(b.oportunidade_score ?? opB?.score ?? 0) / 100;
      return pB - pA;
    });

    const batch = candidates.slice(0, limit);
    let done = 0;
    let enriched = 0;

    for (const c of batch) {
      const proto = String(c.protocolo || '').trim();
      if (!proto) continue;
      try {
        const r = await scanSingleCaseAction(proto, { mode: 'both', fast: false });
        done++;
        if (r && (r as any).success !== false) enriched++;
      } catch {
        done++;
      }
    }

    return {
      success: true,
      done,
      enriched,
      remaining: Math.max(0, candidates.length - batch.length),
    };
  } catch (e: any) {
    return {
      success: false,
      done: 0,
      enriched: 0,
      remaining: 0,
      error: e?.message || 'Falha no enriquecimento seletivo',
    };
  }
}


/** Próxima página da lista /processos (empresa). onlyAtivos=true por padrão. */
export async function fetchCompanyProcessosPageAction(opts?: {
  offset?: number;
  limit?: number;
  onlyAtivos?: boolean;
}) {
  try {
    const { getStoredCasesPageForEmpresa, getUserContext } = await import("@/lib/server-db");
    const ctx = await getUserContext();
    if (!ctx.empresa_id) return { ok: false, cases: [] as any[] };
    const limit = Math.min(Math.max(opts?.limit ?? 200, 50), 500);
    const offset = Math.max(opts?.offset ?? 0, 0);
    const onlyAtivos = opts?.onlyAtivos !== false;
    const cases = await getStoredCasesPageForEmpresa(
      ctx.empresa_id,
      limit,
      offset,
      true,
      { onlyAtivos }
    );
    return { ok: true, cases: cases || [], offset, limit };
  } catch (e: any) {
    return { ok: false, cases: [] as any[], error: e?.message };
  }
}

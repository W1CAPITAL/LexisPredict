/**
 * @copyright 2026 Davi Alves Figueredo / W1 Capital Assessoria Financeira Ltda.
 * MOTOR DE ESTADO DO SCANNER GLOBAL v10.0 — BOTH real + nuvem contínua (sem Cron)
 */
import { create } from 'zustand';
import { scanSingleCaseAction } from '@/app/actions/case-actions';
import { useAppStore } from '@/store/use-app-store';
import { isCasoEncerrado } from '@/lib/status-encerrado';
import { prioritizeScanQueue } from '@/lib/case-filters';
import { filterQueueByScanScope, type ScanScope } from '@/lib/scan-scope-cumprimento';
import { readScanProgress, writeScanProgress, clearScanProgress, readCarteiraCache, writeCarteiraCache } from '@/lib/session-carteira-cache';
import { appendScanLog } from '@/lib/scan-event-log';
import { isScanFresh, scanDelayMs, sleepMs } from '@/lib/parados-scan-queue';
import { mensagemScanHttp } from '@/lib/scan-http-pt';
import { labelResultadoCumprimentoScan, cumprimentoPendenteIndefinido } from '@/lib/cumprimento-scan-labels';

export type ScanStatus = 'idle' | 'running' | 'paused' | 'done' | 'cancelled';
export type ScanMode = 'datajud' | 'djen' | 'both';
export type { ScanScope } from '@/lib/scan-scope-cumprimento';

interface CourtHealth {
  id: string;
  status: 'online' | 'slow' | 'offline';
  avgLatency: number;
  successRate: number;
  totalCalls: number;
  successCalls: number;
}

export interface ScanLog {
  protocolo: string;
  message: string;
  latency: number;
  success: boolean;
  type: 'update' | 'closed' | 'error' | 'ok' | 'ai';
  engine: 'Local' | 'Nuvem';
  source?: 'DataJud' | 'DJEN' | 'Both' | 'Claude';
  aiEngine?: string | null;
}

interface DataJudScanState {
  status: ScanStatus;
  total: number;
  done: number;
  alerts: number;
  cloudDjenAlerts: number;
  closed: number;
  pending: number;
  cycles: number;

  manualStatus: ScanStatus;
  manualTotal: number;
  manualDone: number;
  manualAlerts: number;
  manualClosed: number;
  manualDjenAlerts: number;
  manualErrors: number;
  lastLogs: ScanLog[];

  scanMode: ScanMode;
  setScanMode: (mode: ScanMode) => void;
  /** full = carteira; cumprimento = só procedentes / falta instaurar / fase executiva */
  scanScope: ScanScope;
  setScanScope: (scope: ScanScope) => void;
  /** Claude via OmniRoute no scanner — só após o operador ativar */
  claudeAiEnabled: boolean;
  setClaudeAiEnabled: (on: boolean) => void;
  isMinimized: boolean;
  courtHealthMap: Record<string, CourtHealth>;

  toggleMinimize: () => void;
  startCloudScan: () => void;
  pauseCloudScan: () => void;
  startManualScan: (opts?: { resume?: boolean; scope?: ScanScope }) => Promise<void>;
  resumeManualScan: () => Promise<void>;
  pauseManualScan: () => void;
  resetScan: () => void;
  pollStatus: () => Promise<void>;
  updateCourtHealth: (courtId: string, latency: number, success: boolean) => void;
  runInitialHealthCheck: (protocols: string[]) => Promise<void>;
  addLog: (log: ScanLog) => void;
}

let pollTimer: ReturnType<typeof setInterval> | null = null;
const CLOUD_POLL_MS = 15000; // espera worker terminar DataJud antes do próximo tiro

export const useDataJudScanStore = create<DataJudScanState>((set, get) => ({
  status: 'idle',
  total: 0,
  done: 0,
  alerts: 0,
  cloudDjenAlerts: 0,
  closed: 0,
  pending: 0,
  cycles: 0,

  manualStatus: 'idle',
  manualTotal: 0,
  manualDone: 0,
  manualAlerts: 0,
  manualClosed: 0,
  manualDjenAlerts: 0,
  manualErrors: 0,
  lastLogs: [],

  scanMode: 'both',
  setScanMode: (scanMode) => set({ scanMode }),
  scanScope: 'full',
  setScanScope: (scanScope) => set({ scanScope }),
  claudeAiEnabled: false,
  setClaudeAiEnabled: (claudeAiEnabled) => set({ claudeAiEnabled }),
  isMinimized: true,
  courtHealthMap: {},

  toggleMinimize: () => set((state) => ({ isMinimized: !state.isMinimized })),

  addLog: (log) =>
    set((state) => {
      // LOTE2: logs SISTEMA sempre empilham; demais CNJ dedup por protocolo+engine
      const isSys = String(log.protocolo || '').toUpperCase() === 'SISTEMA';
      const filtered = isSys
        ? state.lastLogs
        : state.lastLogs.filter(
            (l) => !(l.protocolo === log.protocolo && l.engine === log.engine && l.message === log.message)
          );
      return { lastLogs: [log, ...filtered].slice(0, 120) };
    }),

  updateCourtHealth: (courtId, latency, success) => {
    set((state) => {
      const current = state.courtHealthMap[courtId] || {
        id: courtId,
        status: 'online' as const,
        avgLatency: latency,
        successRate: 1,
        totalCalls: 0,
        successCalls: 0,
      };
      const newTotal = current.totalCalls + 1;
      const newSuccess = success ? current.successCalls + 1 : current.successCalls;
      const newRate = newSuccess / newTotal;
      const newAvgLatency =
        current.totalCalls === 0 ? latency : current.avgLatency * 0.7 + latency * 0.3;
      let newStatus: 'online' | 'slow' | 'offline' = 'online';
      if (newRate < 0.4) newStatus = 'offline';
      else if (newAvgLatency > 15000 || newRate < 0.7) newStatus = 'slow';
      return {
        courtHealthMap: {
          ...state.courtHealthMap,
          [courtId]: {
            ...current,
            totalCalls: newTotal,
            successCalls: newSuccess,
            successRate: newRate,
            avgLatency: newAvgLatency,
            status: newStatus,
          },
        },
      };
    });
  },

  runInitialHealthCheck: async (protocols) => {
    for (const proto of protocols.slice(0, 8)) {
      const start = Date.now();
      const res = await scanSingleCaseAction(proto, { fast: true, mode: 'both' });
      const latency = Date.now() - start;
      const courtId = proto.split('.')[4];
      if (courtId) get().updateCourtHealth(courtId, latency, !!res.success);
    }
  },

  startCloudScan: () => {
    const scope = get().scanScope || 'full';
    const mode = get().scanMode || 'both';
    set({ status: 'running', isMinimized: false, cycles: 0 });
    get().addLog({
      protocolo: 'SISTEMA',
      message:
        scope === 'cumprimento'
          ? `Nuvem Hybrid · escopo CUMPRIMENTO · modo ${String(mode).toUpperCase()} — micro-lotes só de candidatos a proceder/instaurar`
          : `Nuvem Hybrid · escopo FULL · modo ${String(mode).toUpperCase()} — carteira rotativa`,
      latency: 0,
      success: true,
      type: 'ok',
      engine: 'Nuvem',
      source: mode === 'both' ? 'Both' : mode === 'datajud' ? 'DataJud' : 'DJEN',
    });
    if (pollTimer) clearInterval(pollTimer);
    get().pollStatus();
    pollTimer = setInterval(() => get().pollStatus(), CLOUD_POLL_MS);
  },

  pauseCloudScan: () => {
    set({ status: 'paused' });
    if (pollTimer) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
  },

  /**
   * Scanner LOCAL — respeita scanMode:
   * - datajud = só tribunal
   * - djen = só diário
   * - both = DataJud + DJEN (mesmo núcleo auditCaseCoreSystem)
   */
  startManualScan: async (opts?: { resume?: boolean; scope?: ScanScope }) => {
    const mode = get().scanMode || 'both';
    const scope: ScanScope = opts?.scope || get().scanScope || 'full';
    if (opts?.scope) set({ scanScope: opts.scope });
    const resume = opts?.resume === true;
    const savedProg = readScanProgress();
    const startFrom = resume
      ? Math.max(0, get().manualDone || savedProg?.manualDone || 0)
      : 0;
    if (!resume) clearScanProgress();
    // Feedback imediato na UI (evita "cliquei e nada acontece")
    set({
      isMinimized: false,
      manualStatus: 'running',
      ...(resume
        ? {}
        : {
            manualDone: 0,
            manualAlerts: 0,
            manualClosed: 0,
            manualDjenAlerts: 0,
            manualErrors: 0,
            // LOTE2: não apaga o feed inteiro — mantém últimos 15 para contexto
            lastLogs: get().lastLogs.slice(0, 15),
          }),
    });
    get().addLog({
      protocolo: 'SISTEMA',
      message: resume
        ? 'Retomando varredura local…'
        : 'Iniciando varredura local… ativos primeiro; encerrados depois (checa cumprimento/falta instaurar)',
      latency: 0,
      success: true,
      type: 'ok',
      engine: 'Local',
      source: mode === 'both' ? 'Both' : mode === 'datajud' ? 'DataJud' : 'DJEN',
    });

    // Inclui ENCERRADOS/ARQUIVADOS: scanner verifica se falta instaurar cumprimento ou se está realmente fechado
    let allLocal = useAppStore.getState().cases || [];
    // Lote4: escopo CUMPRIMENTO — atualiza carteira do servidor antes de filtrar (evita fila vazia)
    if (scope === 'cumprimento') {
      try {
        const { fetchRepoCases } = await import('@/app/actions/case-actions');
        const remote = await fetchRepoCases();
        if (Array.isArray(remote) && remote.length > 0) {
          const setCases = useAppStore.getState().setCases;
          if (typeof setCases === 'function') setCases(remote);
          try { writeCarteiraCache(remote); } catch { /* */ }
          allLocal = remote;
          get().addLog({
            protocolo: 'SISTEMA',
            message: `Carteira sincronizada: ${remote.length} processo(s) para filtrar cumprimento`,
            latency: 0,
            success: true,
            type: 'ok',
            engine: 'Local',
          });
        }
      } catch (e) {
        console.warn('[startManualScan] sync cumprimento', e);
      }
    }
    const nEnc = allLocal.filter((c) => isCasoEncerrado(c)).length;
    let cases = prioritizeScanQueue(allLocal);
    const scoped = filterQueueByScanScope(cases, scope);
    cases = scoped.queue;
    if (scope === 'cumprimento') {
      get().addLog({
        protocolo: 'SISTEMA',
        message: cases.length
          ? `Escopo CUMPRIMENTO: ${cases.length} candidato(s) · ${scoped.filteredOut} fora da fila (carteira completa disponível no escopo Full)`
          : 'Escopo CUMPRIMENTO: nenhum candidato ainda — rode Full uma vez ou use “Reclassificar” na aba Ações Procedentes',
        latency: 0,
        success: true,
        type: 'ok',
        engine: 'Local',
        source: mode === 'both' ? 'Both' : mode === 'datajud' ? 'DataJud' : 'DJEN',
      });
    }
    if (nEnc > 0) {
      get().addLog({
        protocolo: 'SISTEMA',
        message: `Fila local com ${nEnc} processo(s) encerrado(s)/arquivado(s) — análise de cumprimento/procedência (falta instaurar?)`,
        latency: 0,
        success: true,
        type: 'ok',
        engine: 'Local',
      });
    }

    // Lote4: store vazia OU escopo cumprimento sem candidatos na memória → busca servidor
    if (cases.length === 0) {
      try {
        const { fetchRepoCases } = await import('@/app/actions/case-actions');
        const remote = await fetchRepoCases();
        if (Array.isArray(remote) && remote.length > 0) {
          const setCases = useAppStore.getState().setCases;
          // REPLACE store — nunca merge com cache residual
          if (typeof setCases === 'function') setCases(remote);
          writeCarteiraCache(remote);
          const nEncR = remote.filter((c: any) => isCasoEncerrado(c)).length;
          cases = prioritizeScanQueue(remote);
          const scopedR = filterQueueByScanScope(cases, scope);
          cases = scopedR.queue;
          if (scope === 'cumprimento') {
            get().addLog({
              protocolo: 'SISTEMA',
              message: `Escopo CUMPRIMENTO (remoto): ${cases.length} candidato(s)`,
              latency: 0,
              success: true,
              type: 'ok',
              engine: 'Local',
            });
          }
          if (nEncR > 0) {
            get().addLog({
              protocolo: 'SISTEMA',
              message: `Carteira remota: ${nEncR} encerrado(s) incluídos na fila para checagem de cumprimento`,
              latency: 0,
              success: true,
              type: 'ok',
              engine: 'Local',
            });
          }
        }
      } catch (e: any) {
        get().addLog({
          protocolo: 'SISTEMA',
          message: `Falha ao carregar carteira: ${e?.message || e}`,
          latency: 0,
          success: false,
          type: 'error',
          engine: 'Local',
        });
      }
    }

    if (cases.length === 0) {
      get().addLog({
        protocolo: 'SISTEMA',
        message:
          'Nenhum processo na memória (ativos nem encerrados). Abra Dashboard/Processos, aguarde carregar e tente de novo. (RLS/empresa_id pode zerar a lista.)',
        latency: 0,
        success: false,
        type: 'error',
        engine: 'Local',
      });
      set({ manualStatus: 'idle', manualTotal: 0 });
      return;
    }

    set({ manualTotal: cases.length });
    if (startFrom > 0 && startFrom < cases.length) {
      get().addLog({
        protocolo: 'SISTEMA',
        message: `Retomando da posição ${startFrom + 1}/${cases.length}`,
        latency: 0,
        success: true,
        type: 'ok',
        engine: 'Local',
      });
      cases = cases.slice(startFrom);
    } else if (resume && startFrom >= cases.length) {
      get().addLog({
        protocolo: 'SISTEMA',
        message: 'Nada a retomar — fila já concluída. Inicie nova varredura.',
        latency: 0,
        success: true,
        type: 'ok',
        engine: 'Local',
      });
      set({ manualStatus: 'done' });
      return;
    }

    const useClaude = get().claudeAiEnabled === true;
    if (useClaude) {
      get().addLog({
        protocolo: 'SISTEMA',
        message: 'Claude AI (OmniRoute) ATIVADO — analisará cada CNJ após DataJud/DJEN',
        latency: 0,
        success: true,
        type: 'ai',
        engine: 'Local',
        source: 'Claude',
        aiEngine: 'claude',
      });
    } else {
      get().addLog({
        protocolo: 'SISTEMA',
        message: 'Scanner sem Claude AI (só DataJud/DJEN). Ative o botão Claude AI para análise neural.',
        latency: 0,
        success: true,
        type: 'ok',
        engine: 'Local',
        source: mode === 'both' ? 'Both' : mode === 'datajud' ? 'DataJud' : 'DJEN',
      });
    }

    let failStreak = 0;
    for (const c of cases) {
      if (get().manualStatus !== 'running') break;

      const djFresh = mode !== 'djen' && isScanFresh((c as any).datajud_consultado_em);
      const djenFresh = mode !== 'datajud' && isScanFresh((c as any).djen_consultado_em);
      let skip = mode === 'both' ? djFresh && djenFresh : mode === 'datajud' ? djFresh : djenFresh;
      // Lote4: em CUMPRIMENTO, só pula se flags executivas já estão definidas (não só "fresh")
      if (skip && scope === 'cumprimento') {
        const d = (c as any).dados && typeof (c as any).dados === 'object' ? (c as any).dados : {};
        const st = String((c as any).status_executivo || d.status_executivo || '').toLowerCase();
        const definido =
          st === 'ativo' ||
          st === 'encerrado' ||
          st === 'pendente' ||
          (c as any).cumprimento_pendente_necessario === true ||
          (c as any).cumprimento_pendente_necessario === false ||
          !!(c as any).em_cumprimento_sentenca ||
          !!d.em_cumprimento_sentenca;
        // indefinido ou só procedente sem status → reaudita
        if (!definido || cumprimentoPendenteIndefinido(c as any)) {
          skip = false;
        }
      }
      if (skip) {
        set((s) => ({ manualDone: s.manualDone + 1 }));
        get().addLog({
          protocolo: c.protocolo,
          message: 'Pulado: auditado nas últimas 8h',
          latency: 0,
          success: true,
          type: 'ok',
          engine: 'Local',
        });
        appendScanLog({ cnj: c.protocolo, motor: mode, ok: true, detalhe: 'skip-8h' });
        continue;
      }

      const start = Date.now();
      if (useClaude) {
        get().addLog({
          protocolo: c.protocolo,
          message: 'Claude AI trabalhando neste CNJ…',
          latency: 0,
          success: true,
          type: 'ai',
          engine: 'Local',
          source: 'Claude',
          aiEngine: 'claude',
        });
      }
      // mode explícito: both | datajud | djen
      let res: any;
      try {
        res = await scanSingleCaseAction(c.protocolo, {
          mode,
          fast: true,
          useClaudeAi: useClaude,
        });
      } catch (err: any) {
        const latency = Date.now() - start;
        set((s) => ({
          manualErrors: s.manualErrors + 1,
          manualDone: s.manualDone + 1,
        }));
        try {
          const st = get();
          writeScanProgress(st.manualDone || 0, st.manualTotal || 0, st.scanMode);
        } catch {
          /* ignore */
        }
        get().addLog({
          protocolo: c.protocolo,
          message: mensagemScanHttp(err?.message || err),
          latency,
          success: false,
          type: 'error',
          engine: 'Local',
        });
        appendScanLog({ cnj: c.protocolo, motor: mode, ok: false, detalhe: mensagemScanHttp(err?.message || err) });
        failStreak += 1;
        await sleepMs(scanDelayMs(failStreak));
        continue;
      }
      const latency = Date.now() - start;
      const patch = (res?.casePatch as Record<string, any>) || {};

      if (res.success && res.casePatch) {
        if (patch.tem_atualizacao_pos_retorno) set((s) => ({ manualAlerts: s.manualAlerts + 1 }));
        if (patch.djen_nova_comunicacao) set((s) => ({ manualDjenAlerts: s.manualDjenAlerts + 1 }));
        if (patch.datajud_encerrado_tribunal) set((s) => ({ manualClosed: s.manualClosed + 1 }));
        useAppStore.getState().updateCaseByProtocolo?.(c.protocolo, patch);
      } else if (!res.success) {
        set((s) => ({ manualErrors: s.manualErrors + 1 }));
      }

      const srcLabel =
        mode === 'both' ? 'Both' : mode === 'datajud' ? 'DataJud' : 'DJEN';

      const aiLine =
        (res as any).aiLogLine ||
        (patch.ai_log_line as string) ||
        null;
      const aiEng = (res as any).aiEngine || patch.ai_engine || null;
      const labelCumpr = labelResultadoCumprimentoScan(patch);
      const baseMsg =
        (patch.evento_resumo as string) ||
        (res.success ? 'Monitoramento Regular' : (res as any).error || 'Falha na Fonte');
      const message = aiLine
        ? aiLine
        : aiEng
          ? `[IA: ${aiEng}] ${labelCumpr} · ${baseMsg}${patch.ai_flags_label ? ` | ${patch.ai_flags_label}` : ''}`
          : scope === 'cumprimento'
            ? `${labelCumpr} · ${baseMsg}`
            : baseMsg;

      get().addLog({
        protocolo: c.protocolo,
        message,
        latency,
        success: !!res.success,
        type: patch.datajud_encerrado_tribunal
          ? 'closed'
          : patch.indicio_busca_apreensao || patch.alerta_ia
            ? 'ai'
            : patch.tem_atualizacao_pos_retorno || patch.djen_nova_comunicacao
              ? 'update'
              : res.success
                ? 'ok'
                : 'error',
        engine: 'Local',
        source: aiEng ? 'Claude' : srcLabel,
        aiEngine: aiEng,
      });

      set((s) => ({ manualDone: s.manualDone + 1 }));
      appendScanLog({
        cnj: c.protocolo,
        motor: mode,
        ok: !!res.success,
        detalhe: String(message || '').slice(0, 120),
      });
      if (res.success) failStreak = 0;
      else failStreak += 1;
      await sleepMs(scanDelayMs(failStreak));
      // LOTE2: heartbeat a cada 10 CNJs no feed (confiança visual)
      {
        const st = get();
        if (st.manualDone > 0 && st.manualDone % 10 === 0) {
          get().addLog({
            protocolo: 'SISTEMA',
            message: `Progresso ${st.manualDone}/${st.manualTotal || '?'} · alertas ${st.manualAlerts} · DJEN ${st.manualDjenAlerts} · erros ${st.manualErrors}`,
            latency: 0,
            success: true,
            type: 'ok',
            engine: 'Local',
          });
        }
      }
      try {
        const st = get();
        writeScanProgress(st.manualDone || 0, st.manualTotal || 0, st.scanMode);
      } catch {
        /* ignore */
      }
      const courtId = c.protocolo.split('.')[4];
      if (courtId) get().updateCourtHealth(courtId, latency, !!res.success);

      // intervalo leve entre CNJs (rate limit CNJ)
      await new Promise((r) => setTimeout(r, 450));
    }

    if (get().manualStatus === 'running') {
      clearScanProgress();
      set({ manualStatus: 'done' });
    }
  },

  resumeManualScan: async () => {
    if (get().manualStatus === 'running') return;
    await get().startManualScan({ resume: true, scope: get().scanScope });
  },

  pauseManualScan: () => set({ manualStatus: 'paused' }),

  resetScan: () => {
    if (pollTimer) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
    set({
      status: 'idle',
      total: 0,
      done: 0,
      alerts: 0,
      cloudDjenAlerts: 0,
      closed: 0,
      pending: 0,
      cycles: 0,
      manualStatus: 'idle',
      manualDone: 0,
      manualTotal: 0,
      manualErrors: 0,
      manualAlerts: 0,
      manualClosed: 0,
      manualDjenAlerts: 0,
      lastLogs: [],
    });
  },

  /**
   * Nuvem contínua SEM Cron:
   * a cada poll dispara worker (micro-lote) + lê métricas.
   * NÃO para quando pending===0 — continua reprocessando os mais antigos (rotação 24h).
   */
  pollStatus: async () => {
    if (get().status !== 'running') return;
    try {
      set((s) => ({ cycles: s.cycles + 1 }));

      // Fire-and-forget: worker mode=both
      const mode = get().scanMode || 'both';
      const scope = get().scanScope || 'full';
      fetch('/api/datajud-trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode, scope }),
      }).catch(() => {});

      const res = await fetch('/api/datajud-status');
      if (!res.ok) throw new Error('status');
      const metrics = await res.json();

      set({
        total: metrics.total ?? 0,
        done: metrics.audited ?? 0,
        pending: metrics.pending ?? 0,
        alerts: metrics.alerts ?? 0,
        cloudDjenAlerts: metrics.djenAlerts ?? 0,
        closed: metrics.closed ?? 0,
      });

      if (metrics.recentLogs?.length > 0) {
        metrics.recentLogs.forEach((log: ScanLog) =>
          get().addLog({ ...log, engine: log.engine || 'Nuvem' })
        );
      }
      // NÃO set status done — vigilância contínua enquanto o operador mantiver "running"
    } catch (e) {
      console.warn('[Cloud Polling Error]', e);
    }
  },
}));

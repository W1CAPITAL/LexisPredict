/**
 * @copyright 2026 Davi Alves Figueredo / W1 Capital Assessoria Financeira Ltda.
 * MOTOR DE ESTADO DO SCANNER GLOBAL v10.0 — BOTH real + nuvem contínua (sem Cron)
 */
import { create } from 'zustand';
import { scanSingleCaseAction } from '@/app/actions/case-actions';
import { useAppStore } from '@/store/use-app-store';
import { isCasoEncerrado } from '@/lib/status-encerrado';
import { prioritizeScanQueue } from '@/lib/case-filters';

export type ScanStatus = 'idle' | 'running' | 'paused' | 'done' | 'cancelled';
export type ScanMode = 'datajud' | 'djen' | 'both';

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
  /** Claude via OmniRoute no scanner — só após o operador ativar */
  claudeAiEnabled: boolean;
  setClaudeAiEnabled: (on: boolean) => void;
  isMinimized: boolean;
  courtHealthMap: Record<string, CourtHealth>;

  toggleMinimize: () => void;
  startCloudScan: () => void;
  pauseCloudScan: () => void;
  startManualScan: (opts?: { resume?: boolean }) => Promise<void>;
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
  claudeAiEnabled: false,
  setClaudeAiEnabled: (claudeAiEnabled) => set({ claudeAiEnabled }),
  isMinimized: true,
  courtHealthMap: {},

  toggleMinimize: () => set((state) => ({ isMinimized: !state.isMinimized })),

  addLog: (log) =>
    set((state) => {
      const filtered = state.lastLogs.filter(
        (l) => !(l.protocolo === log.protocolo && l.engine === log.engine)
      );
      return { lastLogs: [log, ...filtered].slice(0, 60) };
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
    set({ status: 'running', isMinimized: false, cycles: 0 });
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
  startManualScan: async (opts?: { resume?: boolean }) => {
    const mode = get().scanMode || 'both';
    const resume = opts?.resume === true;
    const startFrom = resume ? Math.max(0, get().manualDone || 0) : 0;
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
          }),
    });
    get().addLog({
      protocolo: 'SISTEMA',
      message: 'Iniciando varredura local… ativos primeiro; encerrados depois (checa cumprimento/falta instaurar)',
      latency: 0,
      success: true,
      type: 'ok',
      engine: 'Local',
      source: mode === 'both' ? 'Both' : mode === 'datajud' ? 'DataJud' : 'DJEN',
    });

    // Inclui ENCERRADOS/ARQUIVADOS: scanner verifica se falta instaurar cumprimento ou se está realmente fechado
    const allLocal = useAppStore.getState().cases || [];
    const nEnc = allLocal.filter((c) => isCasoEncerrado(c)).length;
    let cases = prioritizeScanQueue(allLocal);
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

    // Se a store estiver vazia (ex.: RLS / refresh), tenta buscar no servidor
    if (cases.length === 0) {
      try {
        const { fetchRepoCases } = await import('@/app/actions/case-actions');
        const remote = await fetchRepoCases();
        if (Array.isArray(remote) && remote.length > 0) {
          const setCases = useAppStore.getState().setCases;
          if (typeof setCases === 'function') setCases(remote);
          const nEncR = remote.filter((c: any) => isCasoEncerrado(c)).length;
          cases = prioritizeScanQueue(remote);
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

    for (const c of cases) {
      if (get().manualStatus !== 'running') break;

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
        set((s) => ({ manualErrors: s.manualErrors + 1, manualDone: s.manualDone + 1 }));
        get().addLog({
          protocolo: c.protocolo,
          message: `Erro no scanner: ${err?.message || err}`,
          latency,
          success: false,
          type: 'error',
          engine: 'Local',
        });
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
      const baseMsg =
        (patch.evento_resumo as string) ||
        (res.success ? 'Monitoramento Regular' : (res as any).error || 'Falha na Fonte');
      const message = aiLine
        ? aiLine
        : aiEng
          ? `[IA: ${aiEng}] ${baseMsg}${patch.ai_flags_label ? ` | ${patch.ai_flags_label}` : ''}`
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
      const courtId = c.protocolo.split('.')[4];
      if (courtId) get().updateCourtHealth(courtId, latency, !!res.success);

      // intervalo leve entre CNJs (rate limit CNJ)
      await new Promise((r) => setTimeout(r, 450));
    }

    if (get().manualStatus === 'running') set({ manualStatus: 'done' });
  },

  resumeManualScan: async () => {
    if (get().manualStatus === 'running') return;
    await get().startManualScan({ resume: true });
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
      fetch('/api/datajud-trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'both' }),
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

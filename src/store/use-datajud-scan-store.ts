/**
 * @copyright 2026 Davi Alves Figueredo / W1 Capital Assessoria Financeira Ltda.
 * MOTOR DE ESTADO DO SCANNER GLOBAL v10.0 — BOTH real + nuvem contínua (sem Cron)
 */
import { create } from 'zustand';
import { scanSingleCaseAction } from '@/app/actions/case-actions';
import { useAppStore } from '@/store/use-app-store';
import { isCasoEncerrado } from '@/lib/status-encerrado';

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
  type: 'update' | 'closed' | 'error' | 'ok';
  engine: 'Local' | 'Nuvem';
  source?: 'DataJud' | 'DJEN' | 'Both';
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
  isMinimized: boolean;
  courtHealthMap: Record<string, CourtHealth>;

  toggleMinimize: () => void;
  startCloudScan: () => void;
  pauseCloudScan: () => void;
  startManualScan: () => Promise<void>;
  pauseManualScan: () => void;
  resetScan: () => void;
  pollStatus: () => Promise<void>;
  updateCourtHealth: (courtId: string, latency: number, success: boolean) => void;
  runInitialHealthCheck: (protocols: string[]) => Promise<void>;
  addLog: (log: ScanLog) => void;
}

let pollTimer: ReturnType<typeof setInterval> | null = null;
const CLOUD_POLL_MS = 12000; // mais ciclos/hora sem Cron Vercel

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
  startManualScan: async () => {
    const mode = get().scanMode || 'both';
    const cases = useAppStore.getState().cases.filter((c) => !isCasoEncerrado(c));
    if (cases.length === 0) return;

    set({
      manualStatus: 'running',
      manualTotal: cases.length,
      manualDone: 0,
      manualAlerts: 0,
      manualClosed: 0,
      manualDjenAlerts: 0,
      manualErrors: 0,
    });

    for (const c of cases) {
      if (get().manualStatus !== 'running') break;

      const start = Date.now();
      // mode explícito: both | datajud | djen
      const res = await scanSingleCaseAction(c.protocolo, { mode, fast: true });
      const latency = Date.now() - start;
      const patch = (res.casePatch as Record<string, any>) || {};

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

      get().addLog({
        protocolo: c.protocolo,
        message:
          (patch.evento_resumo as string) ||
          (res.success ? 'Monitoramento Regular' : (res as any).error || 'Falha na Fonte'),
        latency,
        success: !!res.success,
        type: patch.datajud_encerrado_tribunal
          ? 'closed'
          : patch.tem_atualizacao_pos_retorno || patch.djen_nova_comunicacao
            ? 'update'
            : res.success
              ? 'ok'
              : 'error',
        engine: 'Local',
        source: srcLabel,
      });

      set((s) => ({ manualDone: s.manualDone + 1 }));
      const courtId = c.protocolo.split('.')[4];
      if (courtId) get().updateCourtHealth(courtId, latency, !!res.success);

      // intervalo leve entre CNJs (rate limit CNJ)
      await new Promise((r) => setTimeout(r, 550));
    }

    if (get().manualStatus === 'running') set({ manualStatus: 'done' });
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

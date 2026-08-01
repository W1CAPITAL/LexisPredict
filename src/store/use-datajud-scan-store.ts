/**
 * @copyright 2026 Davi Alves Figueredo / W1 Capital Assessoria Financeira Ltda.
 * MOTOR DE ESTADO DO SCANNER GLOBAL v9.8 — SINCRONIA ATÔMICA
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

let pollTimer: NodeJS.Timeout | null = null;

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

  addLog: (log) => set(state => {
    const filtered = state.lastLogs.filter(l => l.protocolo !== log.protocolo || l.engine !== log.engine);
    return { lastLogs: [log, ...filtered].slice(0, 50) };
  }),

  updateCourtHealth: (courtId, latency, success) => {
    set(state => {
      const current = state.courtHealthMap[courtId] || {
        id: courtId, status: 'online', avgLatency: latency, successRate: 1, totalCalls: 0, successCalls: 0
      };
      const newTotal = current.totalCalls + 1;
      const newSuccess = success ? current.successCalls + 1 : current.successCalls;
      const newRate = newSuccess / newTotal;
      const newAvgLatency = current.totalCalls === 0 ? latency : (current.avgLatency * 0.7) + (latency * 0.3);
      let newStatus: 'online' | 'slow' | 'offline' = 'online';
      if (newRate < 0.4) newStatus = 'offline';
      else if (newAvgLatency > 15000 || newRate < 0.7) newStatus = 'slow';
      return {
        courtHealthMap: { ...state.courtHealthMap, [courtId]: { ...current, totalCalls: newTotal, successCalls: newSuccess, successRate: newRate, avgLatency: newAvgLatency, status: newStatus } }
      };
    });
  },

  runInitialHealthCheck: async (protocols) => {
    for (const proto of protocols.slice(0, 10)) {
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
    pollTimer = setInterval(() => get().pollStatus(), 10000);
  },

  pauseCloudScan: () => {
    set({ status: 'paused' });
    if (pollTimer) clearInterval(pollTimer);
  },

  startManualScan: async () => {
    const mode = get().scanMode;
    const cases = useAppStore.getState().cases.filter(c => !isCasoEncerrado(c));
    if (cases.length === 0) return;

    set({ manualStatus: 'running', manualTotal: cases.length, manualDone: 0, manualAlerts: 0, manualClosed: 0, manualDjenAlerts: 0, manualErrors: 0 });

    for (const c of cases) {
      if (get().manualStatus !== 'running') break;
      
      const start = Date.now();
      const res = await scanSingleCaseAction(c.protocolo, { mode, fast: true });
      const latency = Date.now() - start;

      const patch = (res.casePatch as Record<string, any>) || {};

      if (res.success && res.casePatch) {
        if (patch.tem_atualizacao_pos_retorno) set(s => ({ manualAlerts: s.manualAlerts + 1 }));
        if (patch.djen_nova_comunicacao) set(s => ({ manualDjenAlerts: s.manualDjenAlerts + 1 }));
        if (patch.datajud_encerrado_tribunal) set(s => ({ manualClosed: s.manualClosed + 1 }));
        
        useAppStore.getState().updateCaseByProtocolo(c.protocolo, patch);
      } else if (!res.success) {
        set(s => ({ manualErrors: s.manualErrors + 1 }));
      }

      get().addLog({ 
        protocolo: c.protocolo, 
        message: patch.evento_resumo || (res.success ? "Monitoramento Regular" : "Falha na Fonte"), 
        latency, success: !!res.success,
        type: patch.datajud_encerrado_tribunal ? 'closed' : (patch.tem_atualizacao_pos_retorno || patch.djen_nova_comunicacao) ? 'update' : (res.success ? 'ok' : 'error'),
        engine: 'Local'
      });
      
      set(s => ({ manualDone: s.manualDone + 1 }));
      const courtId = c.protocolo.split('.')[4];
      if (courtId) get().updateCourtHealth(courtId, latency, !!res.success);
      await new Promise(r => setTimeout(r, 600)); 
    }
    if (get().manualStatus === 'running') set({ manualStatus: 'done' });
  },

  pauseManualScan: () => set({ manualStatus: 'paused' }),

  resetScan: () => {
    if (pollTimer) clearInterval(pollTimer);
    set({ 
      status: 'idle', total: 0, done: 0, alerts: 0, cloudDjenAlerts: 0, closed: 0, pending: 0, cycles: 0,
      manualStatus: 'idle', manualDone: 0, manualTotal: 0, manualErrors: 0, manualAlerts: 0, manualClosed: 0, manualDjenAlerts: 0, lastLogs: []
    });
  },

  pollStatus: async () => {
    if (get().status !== 'running') return;
    try {
      set(s => ({ cycles: s.cycles + 1 }));
      fetch('/api/datajud-trigger', { method: 'POST' }).catch(() => {});
      const res = await fetch('/api/datajud-status');
      if (!res.ok) throw new Error();
      const metrics = await res.json();
      set({ total: metrics.total, done: metrics.audited, pending: metrics.pending, alerts: metrics.alerts, cloudDjenAlerts: metrics.djenAlerts, closed: metrics.closed });
      if (metrics.recentLogs?.length > 0) metrics.recentLogs.forEach((log: ScanLog) => get().addLog(log));
      if (metrics.pending === 0 && metrics.total > 0) { set({ status: 'done' }); if (pollTimer) clearInterval(pollTimer); }
    } catch (e) { console.warn("[Cloud Polling Error]"); }
  }
}));

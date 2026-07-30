/**
 * @copyright 2026 Davi Alves Figueredo / W1 Capital Assessoria Financeira Ltda.
 * MOTOR DE ESTADO DO SCANNER GLOBAL v8.0 — DUAL ENGINE (CLOUD + MANUAL)
 */
import { create } from 'zustand';
import { scanOneDataJudAction } from '@/app/actions/case-actions';
import { useAppStore } from '@/store/use-app-store';
import { isCasoEncerrado } from '@/lib/status-encerrado';

export type ScanStatus = 'idle' | 'running' | 'paused' | 'done' | 'cancelled';

interface CourtHealth {
  id: string;
  status: 'online' | 'slow' | 'offline';
  avgLatency: number;
  successRate: number;
  totalCalls: number;
  successCalls: number;
}

interface DataJudScanState {
  // Motor de Nuvem (Polling)
  status: ScanStatus;
  total: number;
  done: number;
  alerts: number;
  closed: number;
  pending: number;
  cycles: number;

  // Scanner Manual (Browser)
  manualStatus: ScanStatus;
  manualTotal: number;
  manualDone: number;
  manualAlerts: number;
  manualClosed: number;
  manualErrors: number;
  lastLogs: { protocolo: string; message: string; latency: number; success: boolean }[];

  // Global UI
  isMinimized: boolean;
  courtHealthMap: Record<string, CourtHealth>;
  
  // Actions
  toggleMinimize: () => void;
  startCloudScan: () => void;
  pauseCloudScan: () => void;
  startManualScan: () => Promise<void>;
  pauseManualScan: () => void;
  resetScan: () => void;
  pollStatus: () => Promise<void>;
  updateCourtHealth: (courtId: string, latency: number, success: boolean) => void;
}

let pollTimer: NodeJS.Timeout | null = null;

export const useDataJudScanStore = create<DataJudScanState>((set, get) => ({
  status: 'idle',
  total: 0,
  done: 0,
  alerts: 0,
  closed: 0,
  pending: 0,
  cycles: 0,

  manualStatus: 'idle',
  manualTotal: 0,
  manualDone: 0,
  manualAlerts: 0,
  manualClosed: 0,
  manualErrors: 0,
  lastLogs: [],

  isMinimized: true,
  courtHealthMap: {},

  toggleMinimize: () => set((state) => ({ isMinimized: !state.isMinimized })),

  updateCourtHealth: (courtId, latency, success) => {
    set(state => {
      const current = state.courtHealthMap[courtId] || {
        id: courtId,
        status: 'online',
        avgLatency: latency,
        successRate: 1,
        totalCalls: 0,
        successCalls: 0
      };
      const newTotal = current.totalCalls + 1;
      const newSuccess = success ? current.successCalls + 1 : current.successCalls;
      const newRate = newSuccess / newTotal;
      const newAvgLatency = current.totalCalls === 0 ? latency : (current.avgLatency * 0.7) + (latency * 0.3);
      let newStatus: 'online' | 'slow' | 'offline' = 'online';
      if (newRate < 0.4) newStatus = 'offline';
      else if (newAvgLatency > 15000 || newRate < 0.7) newStatus = 'slow';
      return {
        courtHealthMap: {
          ...state.courtHealthMap,
          [courtId]: { ...current, totalCalls: newTotal, successCalls: newSuccess, successRate: newRate, avgLatency: newAvgLatency, status: newStatus }
        }
      };
    });
  },

  startCloudScan: () => {
    set({ status: 'running', isMinimized: false, cycles: 0 });
    if (pollTimer) clearInterval(pollTimer);
    
    get().pollStatus();
    pollTimer = setInterval(() => {
      get().pollStatus();
    }, 10000); // Polling a cada 10s para não saturar
  },

  pauseCloudScan: () => {
    set({ status: 'paused' });
    if (pollTimer) clearInterval(pollTimer);
  },

  startManualScan: async () => {
    const cases = useAppStore.getState().cases.filter(c => !isCasoEncerrado(c));
    if (cases.length === 0) return;

    set({ manualStatus: 'running', manualTotal: cases.length, manualDone: 0, manualAlerts: 0, manualClosed: 0, manualErrors: 0, lastLogs: [] });

    for (const c of cases) {
      if (get().manualStatus !== 'running') break;
      
      const startTime = Date.now();
      const res = await scanOneDataJudAction(c.protocolo, true);
      const latency = Date.now() - startTime;

      if (res.success) {
        if (res.casePatch?.tem_atualizacao_pos_retorno) set(s => ({ manualAlerts: s.manualAlerts + 1 }));
        if (res.casePatch?.datajud_encerrado_tribunal) set(s => ({ manualClosed: s.manualClosed + 1 }));
        
        set(s => ({ 
          manualDone: s.manualDone + 1,
          lastLogs: [{ protocolo: c.protocolo, message: 'Auditado', latency, success: true }, ...s.lastLogs].slice(0, 10)
        }));
        
        const courtId = c.protocolo.split('.')[4]; // Ex: 8.26
        if (courtId) get().updateCourtHealth(courtId, latency, true);
      } else {
        set(s => ({ 
          manualErrors: s.manualErrors + 1,
          manualDone: s.manualDone + 1,
          lastLogs: [{ protocolo: c.protocolo, message: res.message || 'Falha', latency, success: false }, ...s.lastLogs].slice(0, 10)
        }));
        const courtId = c.protocolo.split('.')[4];
        if (courtId) get().updateCourtHealth(courtId, latency, false);
      }

      await new Promise(r => setTimeout(r, 600)); // Gap de rede
    }

    if (get().manualStatus === 'running') set({ manualStatus: 'done' });
  },

  pauseManualScan: () => set({ manualStatus: 'paused' }),

  resetScan: () => {
    if (pollTimer) clearInterval(pollTimer);
    set({ 
      status: 'idle', total: 0, done: 0, alerts: 0, closed: 0, pending: 0, cycles: 0,
      manualStatus: 'idle', manualDone: 0, manualTotal: 0, manualErrors: 0, manualAlerts: 0, manualClosed: 0, lastLogs: []
    });
  },

  pollStatus: async () => {
    if (get().status !== 'running') return;

    try {
      set(s => ({ cycles: s.cycles + 1 }));
      
      // Gatilho via API Scoped
      fetch('/api/datajud-trigger', { method: 'POST' }).catch(() => {});

      // Telemetria via Snapshot de DB
      const res = await fetch('/api/datajud-status');
      if (!res.ok) throw new Error();
      const metrics = await res.json();

      set({
        total: metrics.total,
        done: metrics.audited,
        pending: metrics.pending,
        alerts: metrics.alerts,
        closed: metrics.closed
      });

      if (metrics.pending === 0) {
        set({ status: 'done' });
        if (pollTimer) clearInterval(pollTimer);
      }
    } catch (e) {
      console.warn("[Cloud Polling Error]");
    }
  }
}));

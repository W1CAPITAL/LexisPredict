
/**
 * @copyright 2026 Davi Alves Figueredo / W1 Capital Assessoria Financeira Ltda.
 * MOTOR DE ESTADO DO SCANNER GLOBAL v7.0 — PROTOCOLO ASSÍNCRONO POR POLLING
 */
import { create } from 'zustand';
import { scanOneDataJudAction } from '@/app/actions/case-actions';
import { useAppStore } from '@/store/use-app-store';

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
  status: ScanStatus;
  isMinimized: boolean;
  total: number;
  done: number;
  alerts: number;
  closed: number;
  errors: number;
  pending: number;
  activeWorkers: number;
  courtHealthMap: Record<string, CourtHealth>;
  
  // Actions
  toggleMinimize: () => void;
  startCloudScan: () => void;
  pauseCloudScan: () => void;
  resetScan: () => void;
  pollStatus: () => Promise<void>;
  updateCourtHealth: (courtId: string, latency: number, success: boolean) => void;
}

let pollTimer: NodeJS.Timeout | null = null;

export const useDataJudScanStore = create<DataJudScanState>((set, get) => ({
  status: 'idle',
  isMinimized: true,
  total: 0,
  done: 0,
  alerts: 0,
  closed: 0,
  errors: 0,
  pending: 0,
  activeWorkers: 0,
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
    set({ status: 'running', isMinimized: false });
    if (pollTimer) clearInterval(pollTimer);
    
    // Inicia gatilho e polling imediato
    get().pollStatus();
    pollTimer = setInterval(() => {
      get().pollStatus();
    }, 5000);
  },

  pauseCloudScan: () => {
    set({ status: 'paused' });
    if (pollTimer) clearInterval(pollTimer);
  },

  resetScan: () => {
    set({ status: 'idle', total: 0, done: 0, alerts: 0, closed: 0, errors: 0, pending: 0 });
    if (pollTimer) clearInterval(pollTimer);
  },

  pollStatus: async () => {
    if (get().status !== 'running') return;

    try {
      // 1. Disparar Trigger (Assíncrono no Server)
      fetch('/api/datajud-trigger', { method: 'POST' }).catch(() => {});

      // 2. Consultar Status (Snapshots de DB)
      const res = await fetch('/api/datajud-status');
      if (!res.ok) throw new Error();
      const metrics = await res.json();

      set({
        total: metrics.total,
        done: metrics.audited,
        pending: metrics.pending,
        alerts: metrics.alerts,
        closed: metrics.closed,
        status: metrics.pending === 0 ? 'done' : 'running'
      });

      if (metrics.pending === 0 && pollTimer) {
        clearInterval(pollTimer);
      }
    } catch (e) {
      console.warn("[Polling Error] Aguardando próximo ciclo...");
    }
  }
}));

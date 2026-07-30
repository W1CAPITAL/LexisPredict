/**
 * @copyright 2026 Davi Alves Figueredo / W1 Capital Assessoria Financeira Ltda.
 * MOTOR DE ESTADO DO SCANNER GLOBAL v6.4 — PROTOCOLO DE ESTABILIDADE
 * Concorrência limitada (2) e Gap de 400ms conforme PROMPT.
 */
import { create } from 'zustand';
import { scanOneDataJudAction } from '@/app/actions/case-actions';
import { useAppStore } from '@/store/use-app-store';

export type ScanStatus = 'idle' | 'running' | 'paused' | 'done' | 'cancelled';
export type ScanScope = 'resume' | 'critical' | 'full';

const CONCURRENT_WORKERS = 2; // Conforme PROMPT
const SCAN_GAP_MS = 400; // Conforme PROMPT

interface CourtHealth {
  id: string;
  status: 'online' | 'slow' | 'offline';
  avgLatency: number;
  successRate: number;
  totalCalls: number;
  successCalls: number;
}

interface ScanLog {
  protocolo: string;
  status: 'success' | 'error' | 'warning';
  message: string;
  alerta?: boolean;
  encerrado?: boolean;
  attempts?: number;
  latency?: number;
}

interface DataJudScanState {
  status: ScanStatus;
  scope: ScanScope;
  isMinimized: boolean;
  isAuthPaused: boolean;
  queue: string[];
  currentIndex: number;
  total: number;
  done: number;
  alerts: number;
  closed: number;
  errors: number;
  logs: ScanLog[];
  activeWorkers: number;
  courtHealthMap: Record<string, CourtHealth>;
  
  // Actions
  toggleMinimize: () => void;
  startScan: (protocolos: string[], scope: ScanScope) => Promise<void>;
  pauseScan: () => void;
  resumeScan: () => void;
  resumeInterruptedScan: () => void;
  cancelScan: () => void;
  resetScan: () => void;
  workerLoop: () => Promise<void>;
  loadProgress: () => void;
  updateCourtHealth: (courtId: string, latency: number, success: boolean) => void;
}

const STORAGE_KEY = 'lexis_datajud_scan_v1';

export const useDataJudScanStore = create<DataJudScanState>((set, get) => ({
  status: 'idle',
  scope: 'resume',
  isMinimized: true,
  isAuthPaused: false,
  queue: [],
  currentIndex: 0,
  total: 0,
  done: 0,
  alerts: 0,
  closed: 0,
  errors: 0,
  logs: [],
  activeWorkers: 0,
  courtHealthMap: {},

  toggleMinimize: () => set((state) => ({ isMinimized: !state.isMinimized })),

  loadProgress: () => {
    if (typeof localStorage === 'undefined') return;
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const data = JSON.parse(saved);
        set({ 
          queue: data.queue || [], 
          currentIndex: data.currentIndex || 0,
          total: data.total || 0,
          done: data.done || 0,
          alerts: data.alerts || 0,
          closed: data.closed || 0,
          errors: data.errors || 0,
          logs: data.logs || [],
          scope: data.scope || 'resume',
          status: 'idle'
        });
      } catch (e) {}
    }
  },

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
          [courtId]: {
            ...current,
            totalCalls: newTotal,
            successCalls: newSuccess,
            successRate: newRate,
            avgLatency: newAvgLatency,
            status: newStatus
          }
        }
      };
    });
  },

  startScan: async (protocolos, scope) => {
    set({
      status: 'running',
      scope,
      isMinimized: false,
      isAuthPaused: false,
      total: protocolos.length,
      currentIndex: 0,
      done: 0,
      alerts: 0,
      closed: 0,
      errors: 0,
      logs: [],
      queue: protocolos
    });

    for (let i = 0; i < CONCURRENT_WORKERS; i++) {
      get().workerLoop();
    }
  },

  pauseScan: () => set({ status: 'paused', isAuthPaused: false }),

  resumeScan: () => {
    set({ status: 'running', isMinimized: false, isAuthPaused: false });
    for (let i = 0; i < CONCURRENT_WORKERS; i++) {
      get().workerLoop();
    }
  },

  resumeInterruptedScan: () => {
    const { queue, currentIndex } = get();
    if (queue.length > 0 && currentIndex < queue.length) {
      set({ status: 'running', isMinimized: false, isAuthPaused: false });
      for (let i = 0; i < CONCURRENT_WORKERS; i++) {
        get().workerLoop();
      }
    }
  },

  cancelScan: () => {
    set({ status: 'cancelled', queue: [], currentIndex: 0, status: 'idle' });
    localStorage.removeItem(STORAGE_KEY);
  },

  resetScan: () => {
    set({
      status: 'idle',
      currentIndex: 0,
      done: 0,
      alerts: 0,
      closed: 0,
      errors: 0,
      logs: [],
      queue: [],
      activeWorkers: 0
    });
    localStorage.removeItem(STORAGE_KEY);
  },

  workerLoop: async () => {
    set(state => ({ activeWorkers: state.activeWorkers + 1 }));

    while (get().status === 'running') {
      let protocolo = '';
      
      set(state => {
        if (state.currentIndex < state.queue.length) {
          protocolo = state.queue[state.currentIndex];
          return { currentIndex: state.currentIndex + 1 };
        }
        return {};
      });

      if (!protocolo) break;

      const startTime = Date.now();
      try {
        const result = await scanOneDataJudAction(protocolo, true);
        const latency = Date.now() - startTime;

        const match = protocolo.match(/\.(\d)\.(\d{2})\./);
        if (match) {
          get().updateCourtHealth(`${match[1]}.${match[2]}`, latency, !!result.success);
        }

        if (result.success && result.casePatch) {
          useAppStore.getState().updateCaseByProtocolo(protocolo, result.casePatch);
        }

        const logStatus = result.success ? (result.casePatch?.datajud_encerrado_tribunal || result.casePatch?.tem_atualizacao_pos_retorno ? 'warning' : 'success') : 'error';
        const newLog: ScanLog = {
          protocolo,
          status: logStatus,
          message: result.message || (result.success ? "Auditado" : "Falha Tribunal"),
          alerta: result.casePatch?.tem_atualizacao_pos_retorno,
          encerrado: result.casePatch?.datajud_encerrado_tribunal,
          latency
        };

        set(state => ({
          done: state.done + 1,
          alerts: result.casePatch?.tem_atualizacao_pos_retorno ? state.alerts + 1 : state.alerts,
          closed: result.casePatch?.datajud_encerrado_tribunal ? state.closed + 1 : state.closed,
          errors: !result.success ? state.errors + 1 : state.errors,
          logs: [newLog, ...state.logs].slice(0, 100)
        }));

        const s = get();
        localStorage.setItem(STORAGE_KEY, JSON.stringify({
          queue: s.queue,
          currentIndex: s.currentIndex,
          total: s.total,
          done: s.done,
          alerts: s.alerts,
          closed: s.closed,
          errors: s.errors,
          logs: s.logs,
          scope: s.scope
        }));

      } catch (e) {
        set(state => ({ 
          done: state.done + 1, 
          errors: state.errors + 1,
          logs: [{ protocolo, status: 'error', message: "Erro Inesperado" }, ...state.logs].slice(0, 100)
        }));
      }

      await sleep(SCAN_GAP_MS);
    }

    set(state => {
      const nextActive = state.activeWorkers - 1;
      const currentS = get();
      if (nextActive <= 0 && currentS.currentIndex >= currentS.queue.length && currentS.status === 'running') {
        return { activeWorkers: 0, status: 'done' };
      }
      return { activeWorkers: Math.max(0, nextActive) };
    });
  }
}));

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * @copyright 2026 Davi Alves Figueredo / W1 Capital Assessoria Financeira Ltda.
 * MOTOR DE ESTADO DO SCANNER GLOBAL v5.0 — WORKPOOL CONCORRENTE
 * Implementa 5 workers simultâneos com Backoff e Circuit Breaker.
 */
import { create } from 'zustand';
import { scanOneDataJudAction } from '@/app/actions/case-actions';
import { useAppStore } from '@/store/use-app-store';

export type ScanStatus = 'idle' | 'running' | 'paused' | 'done' | 'cancelled';
export type ScanScope = 'resume' | 'critical' | 'full';

const CONCURRENT_WORKERS = 5;
const SCAN_GAP_MS = 500; 

interface ScanLog {
  protocolo: string;
  status: 'success' | 'error' | 'warning';
  message: string;
  alerta?: boolean;
  encerrado?: boolean;
  attempts?: number;
}

interface DataJudScanState {
  status: ScanStatus;
  scope: ScanScope;
  isMinimized: boolean;
  isAuthPaused: boolean;
  queue: string[];
  failedQueue: string[];
  currentIndex: number;
  total: number;
  done: number;
  alerts: number;
  closed: number;
  errors: number;
  logs: ScanLog[];
  activeWorkers: number;
  
  // Actions
  toggleMinimize: () => void;
  startScan: (protocolos: string[], scope: ScanScope) => void;
  pauseScan: () => void;
  resumeScan: () => void;
  resumeInterruptedScan: () => void;
  cancelScan: () => void;
  resetScan: () => void;
  workerLoop: () => Promise<void>;
  loadProgress: () => void;
}

const STORAGE_KEY = 'lexis_datajud_scan_v1';

export const useDataJudScanStore = create<DataJudScanState>((set, get) => ({
  status: 'idle',
  scope: 'resume',
  isMinimized: true,
  isAuthPaused: false,
  queue: [],
  failedQueue: [],
  currentIndex: 0,
  total: 0,
  done: 0,
  alerts: 0,
  closed: 0,
  errors: 0,
  logs: [],
  activeWorkers: 0,

  toggleMinimize: () => set((state) => ({ isMinimized: !state.isMinimized })),

  loadProgress: () => {
    if (typeof localStorage === 'undefined') return;
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const data = JSON.parse(saved);
        set({ 
          queue: data.queue || [], 
          failedQueue: data.failedQueue || [],
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

  startScan: (protocolos, scope) => {
    set({
      status: 'running',
      scope,
      isMinimized: false,
      isAuthPaused: false,
      queue: protocolos,
      failedQueue: [],
      total: protocolos.length,
      currentIndex: 0,
      done: 0,
      alerts: 0,
      closed: 0,
      errors: 0,
      logs: [{
        protocolo: 'SISTEMA',
        status: 'success',
        message: `Iniciando Workpool: ${protocolos.length} registros com ${CONCURRENT_WORKERS} workers.`
      }]
    });

    // Iniciar Workers em paralelo
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
    set({ status: 'cancelled', queue: [], failedQueue: [] });
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
      failedQueue: [],
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

      try {
        const result = await scanOneDataJudAction(protocolo, true);

        if (result.success && result.casePatch) {
          useAppStore.getState().updateCaseByProtocolo(protocolo, result.casePatch);
        }

        if (!result.success && result.isAuthError) {
          set({ status: 'paused', isAuthPaused: true });
          break;
        }

        const logStatus = result.success ? (result.encerrado || result.alerta ? 'warning' : 'success') : 'error';
        const newLog: ScanLog = {
          protocolo,
          status: logStatus,
          message: result.message || "Auditado",
          alerta: result.alerta,
          encerrado: result.encerrado,
          attempts: result.attempts
        };

        set(state => ({
          done: state.done + 1,
          alerts: result.alerta ? state.alerts + 1 : state.alerts,
          closed: result.encerrado ? state.closed + 1 : state.closed,
          errors: !result.success ? state.errors + 1 : state.errors,
          logs: [newLog, ...state.logs].slice(0, 100)
        }));

        // Persistência de progresso
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
          logs: [{ protocolo, status: 'error', message: "Falha de Infraestrutura" }, ...state.logs].slice(0, 100)
        }));
      }

      await sleep(SCAN_GAP_MS);
    }

    set(state => {
      const nextActive = state.activeWorkers - 1;
      if (nextActive === 0 && state.currentIndex >= state.queue.length && state.status === 'running') {
        return { activeWorkers: 0, status: 'done' };
      }
      return { activeWorkers: nextActive };
    });
  }
}));

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

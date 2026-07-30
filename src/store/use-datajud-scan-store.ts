
/**
 * @copyright 2026 Davi Alves Figueredo / W1 Capital Assessoria Financeira Ltda.
 * MOTOR DE ESTADO DO SCANNER GLOBAL v6.0 — ADAPTIVE WORKPOOL & COURT HEALTH
 * Implementa 5 workers simultâneos com Health Check adaptativo e ordenação por performance.
 */
import { create } from 'zustand';
import { scanOneDataJudAction } from '@/app/actions/case-actions';
import { useAppStore } from '@/store/use-app-store';

export type ScanStatus = 'idle' | 'running' | 'paused' | 'done' | 'cancelled';
export type ScanScope = 'resume' | 'critical' | 'full';

const CONCURRENT_WORKERS = 5;
const SCAN_GAP_MS = 500; 

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
  runInitialHealthCheck: (protocolos: string[]) => Promise<string[]>;
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
      const newAvgLatency = (current.avgLatency * current.totalCalls + latency) / newTotal;

      let newStatus: 'online' | 'slow' | 'offline' = 'online';
      if (newRate < 0.3) newStatus = 'offline';
      else if (newAvgLatency > 10000 || newRate < 0.7) newStatus = 'slow';

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

  runInitialHealthCheck: async (protocolos) => {
    // Identifica tribunais únicos
    const courtSampleMap: Record<string, string> = {};
    protocolos.forEach(p => {
      const match = p.match(/\.(\d)\.(\d{2})\./);
      if (match) {
        const courtId = `${match[1]}.${match[2]}`;
        if (!courtSampleMap[courtId]) courtSampleMap[courtId] = p;
      }
    });

    const courts = Object.keys(courtSampleMap);
    set({ logs: [{ protocolo: 'SISTEMA', status: 'success', message: `Iniciando Health Check de ${courts.length} tribunais...` }] });

    // Executa um ping paralelo por tribunal
    await Promise.all(courts.map(async (courtId) => {
      const sampleP = courtSampleMap[courtId];
      const start = Date.now();
      try {
        const res = await scanOneDataJudAction(sampleP, true);
        const lat = Date.now() - start;
        get().updateCourtHealth(courtId, lat, res.success);
      } catch (e) {
        get().updateCourtHealth(courtId, 20000, false);
      }
    }));

    // Re-ordena a fila baseada na saúde
    return [...protocolos].sort((a, b) => {
      const getScore = (p: string) => {
        const match = p.match(/\.(\d)\.(\d{2})\./);
        if (!match) return 0;
        const health = get().courtHealthMap[`${match[1]}.${match[2]}`];
        if (!health) return 50; // Neutro
        if (health.status === 'offline') return -100;
        if (health.status === 'slow') return 10;
        return 100 - (health.avgLatency / 1000); // Prioriza menor latência
      };
      return getScore(b) - getScore(a);
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
      logs: []
    });

    // Rito Adaptativo: Health Check Inicial
    const optimizedQueue = await get().runInitialHealthCheck(protocolos);
    set({ queue: optimizedQueue });

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
    set({ status: 'cancelled', queue: [], currentIndex: 0 });
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

        // Extrai ID do tribunal para o Health Check
        const match = protocolo.match(/\.(\d)\.(\d{2})\./);
        if (match) {
          get().updateCourtHealth(`${match[1]}.${match[2]}`, latency, result.success);
        }

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
          attempts: result.attempts,
          latency
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

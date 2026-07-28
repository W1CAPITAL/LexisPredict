
/**
 * @copyright 2026 Davi Alves Figueredo / W1 Capital Assessoria Financeira Ltda.
 * MOTOR DE ESTADO DO SCANNER GLOBAL v1.5
 * Otimizado com RETOMAR, Persistência Local e Blindagem de Sessão.
 */
import { create } from 'zustand';
import { scanOneDataJudAction } from '@/app/actions/case-actions';
import { useAppStore } from '@/store/use-app-store';

export type ScanStatus = 'idle' | 'running' | 'paused' | 'done' | 'cancelled';
export type ScanScope = 'resume' | 'critical' | 'full';

interface ScanLog {
  protocolo: string;
  status: 'success' | 'error' | 'warning';
  message: string;
  alerta?: boolean;
  encerrado?: boolean;
}

interface DataJudScanState {
  status: ScanStatus;
  scope: ScanScope;
  isMinimized: boolean;
  queue: string[];
  currentIndex: number;
  total: number;
  done: number;
  alerts: number;
  closed: number;
  errors: number;
  logs: ScanLog[];
  
  // Actions
  toggleMinimize: () => void;
  startScan: (protocolos: string[], scope: ScanScope) => void;
  pauseScan: () => void;
  resumeScan: () => void;
  cancelScan: () => void;
  resetScan: () => void;
  processNext: () => Promise<void>;
  loadProgress: () => void;
}

const STORAGE_KEY = 'lexis_datajud_scan_v1';

export const useDataJudScanStore = create<DataJudScanState>((set, get) => ({
  status: 'idle',
  scope: 'critical',
  isMinimized: true,
  queue: [],
  currentIndex: 0,
  total: 0,
  done: 0,
  alerts: 0,
  closed: 0,
  errors: 0,
  logs: [],

  toggleMinimize: () => set((state) => ({ isMinimized: !state.isMinimized })),

  loadProgress: () => {
    if (typeof localStorage === 'undefined') return;
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const data = JSON.parse(saved);
        // Só carrega se for do dia atual (opcional)
        set({ 
          queue: data.queue || [], 
          currentIndex: data.currentIndex || 0,
          total: data.total || 0,
          done: data.done || 0,
          alerts: data.alerts || 0,
          closed: data.closed || 0,
          scope: data.scope || 'resume'
        });
      } catch (e) {}
    }
  },

  startScan: (protocolos, scope) => {
    set({
      status: 'running',
      isMinimized: false,
      scope,
      queue: protocolos,
      total: protocolos.length,
      currentIndex: 0,
      done: 0,
      alerts: 0,
      closed: 0,
      errors: 0,
      logs: [{
        protocolo: 'SISTEMA',
        status: 'success',
        message: `Fila iniciada: ${protocolos.length} processos (${scope.toUpperCase()}).`
      }]
    });
    get().processNext();
  },

  pauseScan: () => set({ status: 'paused' }),

  resumeScan: () => {
    set({ status: 'running', isMinimized: false });
    get().processNext();
  },

  cancelScan: () => {
    set({ status: 'cancelled', queue: [] });
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
      queue: []
    });
    localStorage.removeItem(STORAGE_KEY);
  },

  processNext: async () => {
    const { status, queue, currentIndex } = get();

    if (status !== 'running' || currentIndex >= queue.length) {
      if (currentIndex >= queue.length && queue.length > 0 && status === 'running') {
        set({ status: 'done' });
        localStorage.removeItem(STORAGE_KEY);
      }
      return;
    }

    const protocolo = queue[currentIndex];

    try {
      const result = await scanOneDataJudAction(protocolo);

      if (result.success && result.casePatch) {
        useAppStore.getState().updateCaseByProtocolo(protocolo, result.casePatch);
      }

      // Se for erro de autenticação crítico, pausar a fila
      if (!result.success && result.isAuthError) {
        set({ status: 'paused' });
        set((state) => ({
           logs: [{
             protocolo: 'AUTH_CRITICAL',
             status: 'error',
             message: result.message
           }, ...state.logs].slice(0, 30)
        }));
        return;
      }

      const newState = {
        currentIndex: currentIndex + 1,
        done: get().done + 1,
        alerts: result.alerta ? get().alerts + 1 : get().alerts,
        closed: result.encerrado ? get().closed + 1 : get().closed,
        errors: (!result.success && !result.isAuthError) ? get().errors + 1 : get().errors,
        logs: [{
          protocolo: protocolo,
          status: result.success ? (result.encerrado || result.alerta ? 'warning' : 'success') : 'error',
          message: result.message || "Auditado",
          alerta: result.alerta,
          encerrado: result.encerrado
        }, ...get().logs].slice(0, 30)
      };

      set(newState);

      // Persistir progresso
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        queue: queue,
        currentIndex: newState.currentIndex,
        total: get().total,
        done: newState.done,
        alerts: newState.alerts,
        closed: newState.closed,
        scope: get().scope,
        updatedAt: new Date().toISOString()
      }));

    } catch (e: any) {
      set((state) => ({
        currentIndex: state.currentIndex + 1,
        done: state.done + 1,
        errors: state.errors + 1,
        logs: [{
          protocolo,
          status: 'error',
          message: "Erro inesperado de comunicação"
        }, ...state.logs].slice(0, 30)
      }));
    }

    // Recursão controlada (450ms)
    const nextState = get();
    if (nextState.status === 'running' && nextState.currentIndex < nextState.queue.length) {
      setTimeout(() => get().processNext(), 450);
    } else if (nextState.currentIndex >= nextState.queue.length) {
      set({ status: 'done' });
      localStorage.removeItem(STORAGE_KEY);
    }
  }
}));

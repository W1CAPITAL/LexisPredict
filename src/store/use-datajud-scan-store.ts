
/**
 * @copyright 2026 Davi Alves Figueredo / W1 Capital Assessoria Financeira Ltda.
 * MOTOR DE ESTADO DO SCANNER GLOBAL v1.7
 * Otimizado com RETRIES, BACKOFF e LOGS INFINITOS PERSISTENTES.
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
  attempts?: number;
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
  
  // Actions
  toggleMinimize: () => void;
  startScan: (protocolos: string[], scope: ScanScope) => void;
  pauseScan: () => void;
  resumeScan: () => void;
  resumeInterruptedScan: () => void;
  cancelScan: () => void;
  resetScan: () => void;
  processNext: () => Promise<void>;
  loadProgress: () => void;
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

  startScan: (protocolos, scope) => {
    set({
      status: 'running',
      isMinimized: false,
      isAuthPaused: false,
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

  pauseScan: () => set({ status: 'paused', isAuthPaused: false }),

  resumeScan: () => {
    set({ status: 'running', isMinimized: false, isAuthPaused: false });
    get().processNext();
  },

  resumeInterruptedScan: () => {
    const { queue, currentIndex } = get();
    if (queue.length > 0 && currentIndex < queue.length) {
      set({ status: 'running', isMinimized: false, isAuthPaused: false });
      get().processNext();
    }
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
      queue: [],
      isAuthPaused: false
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
      // O retry com backoff acontece DENTRO desta action via fetchDataJud
      const result = await scanOneDataJudAction(protocolo);

      if (result.success && result.casePatch) {
        try {
          useAppStore.getState().updateCaseByProtocolo(protocolo, result.casePatch);
        } catch (e) {}
      }

      if (!result.success && result.isAuthError) {
        set({ status: 'paused', isAuthPaused: true });
        set((state) => ({
           logs: [{
             protocolo: 'SISTEMA',
             status: 'error',
             message: "SESSÃO EXPIRADA. PAUSADO PARA SEGURANÇA."
           }, ...state.logs]
        }));
        return;
      }

      const newLogs = [{
        protocolo: protocolo,
        status: result.success ? (result.encerrado || result.alerta ? 'warning' : 'success') : 'error',
        message: result.message || "Auditado",
        alerta: result.alerta,
        encerrado: result.encerrado,
        attempts: result.attempts
      }, ...get().logs];

      const newState = {
        currentIndex: currentIndex + 1,
        done: get().done + 1,
        alerts: result.alerta ? get().alerts + 1 : get().alerts,
        closed: result.encerrado ? get().closed + 1 : get().closed,
        errors: (!result.success && !result.isAuthError) ? get().errors + 1 : get().errors,
        logs: newLogs
      };

      set(newState);

      // Persistir progresso com logs infinitos
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        queue: queue,
        currentIndex: newState.currentIndex,
        total: get().total,
        done: newState.done,
        alerts: newState.alerts,
        closed: newState.closed,
        errors: newState.errors,
        logs: newLogs,
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
          message: "ERRO DE INFRAESTRUTURA."
        }, ...state.logs]
      }));
    }

    const nextState = get();
    if (nextState.status === 'running' && nextState.currentIndex < nextState.queue.length) {
      // Intervalo de 1.5s entre protocolos diferentes para não sobrecarregar a API
      setTimeout(() => get().processNext(), 1500);
    } else if (nextState.currentIndex >= nextState.queue.length) {
      set({ status: 'done' });
      // Mantemos o progresso no localStorage para permitir o "reset" manual do operador
    }
  }
}));

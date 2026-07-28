
/**
 * @copyright 2026 Davi Alves Figueredo / W1 Capital Assessoria Financeira Ltda.
 * MOTOR DE ESTADO DO SCANNER GLOBAL v1.3
 * Otimizado com tratamento de fila robusto e sincronização de progresso real-time.
 */
import { create } from 'zustand';
import { scanOneDataJudAction } from '@/app/actions/case-actions';
import { useAppStore } from '@/store/use-app-store';

export type ScanStatus = 'idle' | 'running' | 'paused' | 'done' | 'cancelled';

interface ScanLog {
  protocolo: string;
  status: 'success' | 'error' | 'warning';
  message: string;
  alerta?: boolean;
  encerrado?: boolean;
}

interface DataJudScanState {
  status: ScanStatus;
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
  startScan: (protocolos: string[]) => void;
  pauseScan: () => void;
  resumeScan: () => void;
  cancelScan: () => void;
  resetScan: () => void;
  processNext: () => Promise<void>;
}

export const useDataJudScanStore = create<DataJudScanState>((set, get) => ({
  status: 'idle',
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

  startScan: (protocolos) => {
    set({
      status: 'running',
      isMinimized: false,
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
        message: `Fila montada: ${protocolos.length} processos.`
      }]
    });
    // Disparo inicial da recursão
    get().processNext();
  },

  pauseScan: () => set({ status: 'paused' }),

  resumeScan: () => {
    set({ status: 'running' });
    get().processNext();
  },

  cancelScan: () => set({ status: 'cancelled', queue: [] }),

  resetScan: () => set({
    status: 'idle',
    currentIndex: 0,
    done: 0,
    alerts: 0,
    closed: 0,
    errors: 0,
    logs: [],
    queue: []
  }),

  processNext: async () => {
    const { status, queue, currentIndex } = get();

    // Condição de parada: Fila vazia, fim do índice ou cancelamento
    if (status !== 'running' || currentIndex >= queue.length) {
      if (currentIndex >= queue.length && queue.length > 0 && status === 'running') {
        set({ status: 'done' });
      }
      return;
    }

    const protocolo = queue[currentIndex];

    try {
      // Auditoria unitária no servidor
      const result = await scanOneDataJudAction(protocolo);

      if (result.success && result.casePatch) {
        // Sincronizar UI local instantaneamente via AppStore usando o protocolo
        useAppStore.getState().updateCaseByProtocolo(protocolo, result.casePatch);
      }

      set((state) => ({
        currentIndex: state.currentIndex + 1,
        done: state.done + 1,
        alerts: result.alerta ? state.alerts + 1 : state.alerts,
        closed: result.encerrado ? state.closed + 1 : state.closed,
        errors: (result as any).error ? state.errors + 1 : state.errors,
        logs: [{
          protocolo: protocolo,
          status: result.success ? (result.encerrado || result.alerta ? 'warning' : 'success') : 'error',
          message: result.message || "Auditado",
          alerta: result.alerta,
          encerrado: result.encerrado
        }, ...state.logs].slice(0, 30)
      }));
    } catch (e: any) {
      set((state) => ({
        currentIndex: state.currentIndex + 1,
        done: state.done + 1,
        errors: state.errors + 1,
        logs: [{
          protocolo,
          status: 'error',
          message: e.message || "Erro inesperado"
        }, ...state.logs].slice(0, 30)
      }));
    }

    // Recursão controlada com delay para evitar rate-limit (450ms)
    const nextState = get();
    if (nextState.status === 'running' && nextState.currentIndex < nextState.queue.length) {
      setTimeout(() => get().processNext(), 450);
    } else if (nextState.currentIndex >= nextState.queue.length) {
      set({ status: 'done' });
    }
  }
}));

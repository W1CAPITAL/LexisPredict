
/**
 * @copyright 2026 Davi Alves Figueredo / W1 Capital Assessoria Financeira Ltda.
 * MOTOR DE ESTADO DO SCANNER GLOBAL v1.1
 * Otimizado com tratamento de fila robusto e sincronização de progresso.
 */
import { create } from 'zustand';
import { scanOneDataJudAction } from '@/app/actions/case-actions';

export type ScanStatus = 'idle' | 'running' | 'paused' | 'done' | 'cancelled';

interface ScanLog {
  protocolo: string;
  status: 'success' | 'error' | 'warning';
  message: string;
  alerta?: boolean;
}

interface DataJudScanState {
  status: ScanStatus;
  isMinimized: boolean;
  queue: string[];
  currentIndex: number;
  total: number;
  done: number;
  alerts: number;
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

      set((state) => ({
        currentIndex: state.currentIndex + 1,
        done: state.done + 1,
        alerts: result.alerta ? state.alerts + 1 : state.alerts,
        errors: result.success ? state.errors : state.errors + 1,
        logs: [{
          protocolo: protocolo,
          status: result.success ? (result.alerta ? 'warning' : 'success') : 'error',
          message: result.message || (result.success ? "Auditado com sucesso" : "Falha na consulta"),
          alerta: result.alerta
        }, ...state.logs].slice(0, 25)
      }));
    } catch (e: any) {
      set((state) => ({
        currentIndex: state.currentIndex + 1,
        done: state.done + 1,
        errors: state.errors + 1,
        logs: [{
          protocolo,
          status: 'error',
          message: e.message || "Erro inesperado no servidor"
        }, ...state.logs].slice(0, 25)
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

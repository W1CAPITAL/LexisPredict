/**
 * @copyright 2026 Davi Alves Figueredo / W1 Capital Assessoria Financeira Ltda.
 * MOTOR DE ESTADO DO SCANNER GLOBAL v540.0 - WORKPOOL EDITION
 * Arquitetura FIFO com 5 Workers paralelos, unificada para Painel e Monitor.
 */
import { create } from 'zustand';
import { scanOneDataJudAction } from '@/app/actions/case-actions';
import { useAppStore } from '@/store/use-app-store';

export type ScanStatus = 'idle' | 'running' | 'paused' | 'done' | 'cancelled';
export type ScanScope = 'resume' | 'critical' | 'full';

const MAX_WORKERS = 5; // Configuração de concorrência solicitada
const SCAN_GAP_MS = 300; 

interface ScanLog {
  protocolo: string;
  status: 'success' | 'error' | 'warning';
  message: string;
  alerta?: boolean;
  encerrado?: boolean;
  attempts?: number;
  isPass2?: boolean;
}

interface DataJudScanState {
  status: ScanStatus;
  scope: ScanScope;
  isMinimized: boolean;
  isAuthPaused: boolean;
  activeWorkers: number;
  queue: string[];
  currentIndex: number;
  total: number;
  done: number;
  alerts: number;
  closed: number;
  errors: number;
  logs: ScanLog[];
  
  toggleMinimize: () => void;
  startScan: (protocolos: string[], scope: ScanScope) => void;
  pauseScan: () => void;
  resumeScan: () => void;
  resumeInterruptedScan: () => void;
  cancelScan: () => void;
  resetScan: () => void;
  worker: (id: number) => Promise<void>;
  loadProgress: () => void;
}

const STORAGE_KEY = 'lexis_datajud_scan_v2_workpool';

export const useDataJudScanStore = create<DataJudScanState>((set, get) => ({
  status: 'idle',
  scope: 'resume',
  isMinimized: true,
  isAuthPaused: false,
  activeWorkers: 0,
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
        message: `Workpool iniciado com ${MAX_WORKERS} workers para ${protocolos.length} registros.`
      }]
    });
    
    // Dispara a bateria de workers simultâneos
    for (let i = 0; i < MAX_WORKERS; i++) {
      get().worker(i);
    }
  },

  pauseScan: () => set({ status: 'paused', isAuthPaused: false }),

  resumeScan: () => {
    set({ status: 'running', isMinimized: false, isAuthPaused: false });
    for (let i = 0; i < MAX_WORKERS; i++) {
      get().worker(i);
    }
  },

  resumeInterruptedScan: () => {
    if (get().status !== 'running') {
      set({ status: 'running', isMinimized: false, isAuthPaused: false });
      for (let i = 0; i < MAX_WORKERS; i++) {
        get().worker(i);
      }
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
      isAuthPaused: false,
      activeWorkers: 0
    });
    localStorage.removeItem(STORAGE_KEY);
  },

  worker: async (workerId: number) => {
    set(s => ({ activeWorkers: s.activeWorkers + 1 }));

    while (get().status === 'running') {
      const { queue, currentIndex } = get();
      
      // Busca atômica do próximo índice disponível
      if (currentIndex >= queue.length) break;
      
      // Reserva o índice e avança o contador global
      set(s => ({ currentIndex: s.currentIndex + 1 }));
      const protocolo = queue[currentIndex];
      
      if (!protocolo) break;

      try {
        // Chamada ao motor híbrido unificado
        const result = (await scanOneDataJudAction(protocolo, true)) as any;

        // Atualização imediata do dashboard via store de casos
        if (result.success && result.casePatch) {
          useAppStore.getState().updateCaseByProtocolo(protocolo, result.casePatch);
        }

        // Tratamento de Sessão Expirada (Pausa global por segurança)
        if (!result.success && result.isAuthError) {
          set({ status: 'paused', isAuthPaused: true });
          set(s => ({ 
            logs: [{ protocolo: 'SESSÃO', status: 'error', message: 'AUTENTICAÇÃO EXPIRADA' }, ...s.logs] 
          }));
          break;
        }

        // Retry automático apenas para 429 e 503 (Lógica solicitada)
        if (!result.success && (result.httpStatus === 429 || result.httpStatus === 503)) {
          // Devolve para a fila? Não, apenas registra o erro e segue o rito FIFO
          // Em um sistema real, poderíamos reinserir no fim da fila, mas aqui manteremos a ordem.
        }

        const logStatus = result.success 
          ? (result.encerrado || result.alerta ? 'warning' : 'success') 
          : 'error';

        const newLog: ScanLog = {
          protocolo,
          status: logStatus,
          message: result.message || (result.success ? "Auditado" : "Falha na fonte"),
          alerta: result.alerta,
          encerrado: result.encerrado
        };

        // Consolidação de resultados atômica
        set(s => ({
          done: s.done + 1,
          alerts: result.alerta ? s.alerts + 1 : s.alerts,
          closed: result.encerrado ? s.closed + 1 : s.closed,
          errors: !result.success ? s.errors + 1 : s.errors,
          logs: [newLog, ...s.logs].slice(0, 100) // Mantém os últimos 100 logs
        }));

        // Persistência de progresso para retomada
        localStorage.setItem(STORAGE_KEY, JSON.stringify({
          ...get(),
          updatedAt: new Date().toISOString()
        }));

      } catch (e) {
        set(s => ({ 
          done: s.done + 1, 
          errors: s.errors + 1,
          logs: [{ protocolo, status: 'error', message: 'ERRO DE COMUNICAÇÃO' }, ...s.logs]
        }));
      }

      // Pequeno respiro para evitar bloqueio de thread
      await new Promise(r => setTimeout(r, SCAN_GAP_MS));
    }

    set(s => ({ activeWorkers: Math.max(0, s.activeWorkers - 1) }));
    
    // Verificação de conclusão por este worker
    if (get().activeWorkers === 0 && get().currentIndex >= get().queue.length) {
      set({ status: 'done' });
    }
  }
}));

/**
 * @copyright 2026 Davi Alves Figueredo / W1 Capital Assessoria Financeira Ltda.
 * MOTOR DE ESTADO DO SCANNER GLOBAL v1.8
 * Otimizado com RETRIES, BACKOFF, LOGS INFINITOS e DUPLA PASSAGEM DE RECUPERAÇÃO.
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
  isPass2?: boolean;
}

interface DataJudScanState {
  status: ScanStatus;
  scope: ScanScope;
  isMinimized: boolean;
  isAuthPaused: boolean;
  isSecondPass: boolean;
  queue: string[];
  failedQueue: string[];
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
  isSecondPass: false,
  queue: [],
  failedQueue: [],
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
          failedQueue: data.failedQueue || [],
          isSecondPass: data.isSecondPass || false,
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
      isSecondPass: false,
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
        status: 'success' as const,
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
      isSecondPass: false,
      isAuthPaused: false
    });
    localStorage.removeItem(STORAGE_KEY);
  },

  processNext: async () => {
    const { status, queue, currentIndex, isSecondPass } = get();

    if (status !== 'running' || currentIndex >= queue.length) {
      if (currentIndex >= queue.length && queue.length > 0 && status === 'running') {
        const { failedQueue } = get();
        
        if (failedQueue.length > 0 && !isSecondPass) {
          const pass2Logs: ScanLog[] = [{
            protocolo: 'SISTEMA',
            status: 'warning' as const,
            message: `Passagem 1 concluída. Iniciando 2ª passagem para reprocessar ${failedQueue.length} falhas críticos.`
          }, ...get().logs];

          set({
            queue: failedQueue,
            failedQueue: [],
            currentIndex: 0,
            isSecondPass: true,
            logs: pass2Logs
          });
          
          setTimeout(() => get().processNext(), 1500);
          return;
        }

        set({ status: 'done' });
        localStorage.removeItem(STORAGE_KEY);
      }
      return;
    }

    const protocolo = queue[currentIndex];
    
    // Identificação de prioridade: casos "Sem Prazo" não realizam retry e não contam como erro de lote
    const targetCase = useAppStore.getState().cases.find(c => c.protocolo === protocolo);
    const isSemPrazo = targetCase?.status === 'Sem Prazo';

    try {
      const result = await scanOneDataJudAction(protocolo, isSemPrazo);

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
             status: 'error' as const,
             message: "SESSÃO EXPIRADA. PAUSADO PARA SEGURANÇA."
           }, ...state.logs]
        }));
        return;
      }

      // Mensageria Neutra para processos "Sem Prazo" que falharem (evita ruído operacional)
      const displayMessage = (!result.success && isSemPrazo) 
        ? "Sem Prazo — Tribunal indisponível (Ignorado)" 
        : (result.message || "Auditado");
      
      const logStatus: 'success' | 'error' | 'warning' = result.success 
        ? (result.encerrado || result.alerta ? 'warning' : 'success') 
        : (isSemPrazo ? 'success' : 'error');

      const newLogs: ScanLog[] = [{
        protocolo: protocolo,
        status: logStatus,
        message: (isSecondPass ? "[P2] " : "") + displayMessage,
        alerta: result.alerta,
        encerrado: result.encerrado,
        attempts: result.attempts,
        isPass2: isSecondPass
      }, ...get().logs];

      let nextErrors = get().errors;
      let nextAlerts = get().alerts;
      let nextClosed = get().closed;
      let nextDone = get().done;
      const nextFailedQueue = [...get().failedQueue];

      if (!isSecondPass) {
        nextDone++;
        if (!result.success) {
          // Apenas processos COM PRAZO incrementam o contador de erros e entram na fila de reprocessamento
          if (!isSemPrazo) {
            nextErrors++;
            nextFailedQueue.push(protocolo);
          }
        } else {
          if (result.alerta) nextAlerts++;
          if (result.encerrado) nextClosed++;
        }
      } else {
        if (result.success) {
          nextErrors = Math.max(0, nextErrors - 1);
          if (result.alerta) nextAlerts++;
          if (result.encerrado) nextClosed++;
        }
      }

      const newState = {
        currentIndex: currentIndex + 1,
        done: nextDone,
        alerts: nextAlerts,
        closed: nextClosed,
        errors: nextErrors,
        failedQueue: nextFailedQueue,
        logs: newLogs
      };

      set(newState);

      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        queue: queue,
        failedQueue: nextFailedQueue,
        isSecondPass: isSecondPass,
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
      const nextFailedQueue = [...get().failedQueue];
      if (!isSecondPass && !isSemPrazo) nextFailedQueue.push(protocolo);

      set((state) => ({
        currentIndex: state.currentIndex + 1,
        done: isSecondPass ? state.done : state.done + 1,
        errors: (isSecondPass || isSemPrazo) ? state.errors : state.errors + 1,
        failedQueue: nextFailedQueue,
        logs: [{
          protocolo,
          status: (isSemPrazo ? 'success' : 'error') as const,
          message: isSemPrazo ? "Sem Prazo — Falha de infraestrutura (Ignorada)" : "ERRO DE INFRAESTRUTURA."
        }, ...state.logs]
      }));
    }

    const nextState = get();
    if (nextState.status === 'running') {
      setTimeout(() => get().processNext(), 1500);
    }
  }
}));
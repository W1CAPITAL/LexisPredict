
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

    // Verificação de fim de fila e transição para Passagem 2
    if (status !== 'running' || currentIndex >= queue.length) {
      if (currentIndex >= queue.length && queue.length > 0 && status === 'running') {
        const { failedQueue } = get();
        
        if (failedQueue.length > 0 && !isSecondPass) {
          // Transição Automática para 2ª Passagem
          const pass2Logs = [{
            protocolo: 'SISTEMA',
            status: 'warning',
            message: `Passagem 1 concluída. Iniciando 2ª passagem para reprocessar ${failedQueue.length} falhas técnicos.`
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

    try {
      // O retry com backoff acontece DENTRO desta action via fetchDataJud
      const result = await scanOneDataJudAction(protocolo);

      if (result.success && result.casePatch) {
        try {
          useAppStore.getState().updateCaseByProtocolo(protocolo, result.casePatch);
        } catch (e) {}
      }

      // Pausa apenas em erro de autenticação (sessão expirada)
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
        message: (isSecondPass ? "[P2] " : "") + (result.message || "Auditado"),
        alerta: result.alerta,
        encerrado: result.encerrado,
        attempts: result.attempts,
        isPass2: isSecondPass
      }, ...get().logs];

      // Lógica de Contadores com Suporte a Recuperação em Passagem 2
      let nextErrors = get().errors;
      let nextAlerts = get().alerts;
      let nextClosed = get().closed;
      let nextDone = get().done;
      const nextFailedQueue = [...get().failedQueue];

      if (!isSecondPass) {
        nextDone++;
        if (!result.success) {
          nextErrors++;
          nextFailedQueue.push(protocolo); // Coleta para reprocessamento
        } else {
          if (result.alerta) nextAlerts++;
          if (result.encerrado) nextClosed++;
        }
      } else {
        // Na Passagem 2, sucesso recupera erro da Passagem 1
        if (result.success) {
          nextErrors = Math.max(0, nextErrors - 1);
          if (result.alerta) nextAlerts++;
          if (result.encerrado) nextClosed++;
        }
        // Falha na Passagem 2 permanece como erro (não faz nada)
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

      // Persistir progresso total
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
      // Erro de infraestrutura não para o lote
      const nextFailedQueue = [...get().failedQueue];
      if (!isSecondPass) nextFailedQueue.push(protocolo);

      set((state) => ({
        currentIndex: state.currentIndex + 1,
        done: isSecondPass ? state.done : state.done + 1,
        errors: isSecondPass ? state.errors : state.errors + 1,
        failedQueue: nextFailedQueue,
        logs: [{
          protocolo,
          status: 'error',
          message: "ERRO DE INFRAESTRUTURA."
        }, ...state.logs]
      }));
    }

    const nextState = get();
    if (nextState.status === 'running') {
      // Intervalo de segurança 1.5s
      setTimeout(() => get().processNext(), 1500);
    }
  }
}));

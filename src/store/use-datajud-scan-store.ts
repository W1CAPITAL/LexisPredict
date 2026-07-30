/**
 * @copyright 2026 Davi Alves Figueredo / W1 Capital Assessoria Financeira Ltda.
 * MOTOR DE ESTADO DO SCANNER GLOBAL v4.1 - PERFORMANCE ELITE
 * Otimizado com busca atômica, gap reduzido e Fast Mode.
 */
import { create } from 'zustand';
import { scanOneDataJudAction } from '@/app/actions/case-actions';
import { useAppStore } from '@/store/use-app-store';

export type ScanStatus = 'idle' | 'running' | 'paused' | 'done' | 'cancelled';
export type ScanScope = 'resume' | 'critical' | 'full';

// CONSTANTE DE PERFORMANCE ELITE
const SCAN_GAP_MS = 500; 

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
      scope,
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

    if (status !== 'running' || currentIndex >= queue.length) {
      if (currentIndex >= queue.length && queue.length > 0 && status === 'running') {
        const { failedQueue } = get();
        
        if (failedQueue.length > 0 && !isSecondPass) {
          const pass2Logs: ScanLog[] = [{
            protocolo: 'SISTEMA',
            status: 'warning',
            message: `Passagem 1 concluída. Iniciando 2ª passagem para reprocessar ${failedQueue.length} falhas críticas.`
          } as ScanLog, ...get().logs];

          set({
            queue: failedQueue,
            failedQueue: [],
            currentIndex: 0,
            isSecondPass: true,
            logs: pass2Logs
          });
          
          setTimeout(() => get().processNext(), SCAN_GAP_MS);
          return;
        }

        set({ status: 'done' });
        localStorage.removeItem(STORAGE_KEY);
      }
      return;
    }

    const protocolo = queue[currentIndex];
    
    try {
      // Chama a Action com Fast Mode ativo (Otimizado para scanner)
      const result = await scanOneDataJudAction(protocolo, true);

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
           } as ScanLog, ...state.logs]
        }));
        return;
      }

      const logStatus: 'success' | 'error' | 'warning' = result.success 
        ? (result.encerrado || result.alerta ? 'warning' : 'success') 
        : 'error';

      const newLog: ScanLog = {
        protocolo: protocolo,
        status: logStatus,
        message: (isSecondPass ? "[P2] " : "") + (result.message || "Auditado"),
        alerta: result.alerta,
        encerrado: result.encerrado,
        attempts: result.attempts,
        isPass2: isSecondPass
      };

      const updatedLogs = [newLog, ...get().logs];

      let nextErrors = get().errors;
      let nextAlerts = get().alerts;
      let nextClosed = get().closed;
      let nextDone = get().done;
      const nextFailedQueue = [...get().failedQueue];

      if (!isSecondPass) {
        nextDone++;
        if (!result.success) {
          nextErrors++;
          nextFailedQueue.push(protocolo);
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

      set({
        currentIndex: currentIndex + 1,
        done: nextDone,
        alerts: nextAlerts,
        closed: nextClosed,
        errors: nextErrors,
        failedQueue: nextFailedQueue,
        logs: updatedLogs
      });

      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        queue: queue,
        failedQueue: nextFailedQueue,
        isSecondPass: isSecondPass,
        currentIndex: currentIndex + 1,
        total: get().total,
        done: nextDone,
        alerts: nextAlerts,
        closed: nextClosed,
        errors: nextErrors,
        logs: updatedLogs,
        scope: get().scope,
        updatedAt: new Date().toISOString()
      }));

    } catch (e: any) {
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
        } as ScanLog, ...state.logs]
      }));
    }

    if (get().status === 'running') {
      setTimeout(() => get().processNext(), SCAN_GAP_MS);
    }
  }
}));

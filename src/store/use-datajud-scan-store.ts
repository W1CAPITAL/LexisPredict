/**
 * @copyright 2026 Davi Alves Figueredo / W1 Capital Assessoria Financeira Ltda.
 * MOTOR DE ESTADO DO SCANNER GLOBAL v9.6 — MODULAR (DATAJUD | DJEN | AMBOS)
 * Suporte a ritos processuais com logs sanitizados e auditoria sequencial.
 */
import { create } from 'zustand';
import { scanOneDataJudAction, scanOneDjenAction } from '@/app/actions/case-actions';
import { useAppStore } from '@/store/use-app-store';
import { isCasoEncerrado } from '@/lib/status-encerrado';

export type ScanStatus = 'idle' | 'running' | 'paused' | 'done' | 'cancelled';
export type ScanMode = 'datajud' | 'djen' | 'both';

interface CourtHealth {
  id: string;
  status: 'online' | 'slow' | 'offline';
  avgLatency: number;
  successRate: number;
  totalCalls: number;
  successCalls: number;
}

export interface ScanLog {
  protocolo: string;
  message: string;
  latency: number;
  success: boolean;
  type: 'update' | 'closed' | 'error' | 'ok';
  engine: 'Local' | 'Nuvem';
}

interface DataJudScanState {
  // Motor de Nuvem (Polling)
  status: ScanStatus;
  total: number;
  done: number;
  alerts: number;
  cloudDjenAlerts: number;
  closed: number;
  pending: number;
  cycles: number;

  // Scanner Manual (Browser)
  manualStatus: ScanStatus;
  manualTotal: number;
  manualDone: number;
  manualAlerts: number;
  manualClosed: number;
  manualDjenAlerts: number;
  manualErrors: number;
  
  // Modos e Opções
  scanMode: ScanMode;
  setScanMode: (mode: ScanMode) => void;
  includeDjen24h: boolean; // Legado para compatibilidade se necessário
  setIncludeDjen24h: (val: boolean) => void;

  // Registro Unificado
  lastLogs: ScanLog[];

  // Global UI
  isMinimized: boolean;
  courtHealthMap: Record<string, CourtHealth>;
  
  // Actions
  toggleMinimize: () => void;
  startCloudScan: () => void;
  pauseCloudScan: () => void;
  startManualScan: () => Promise<void>;
  pauseManualScan: () => void;
  resetScan: () => void;
  pollStatus: () => Promise<void>;
  updateCourtHealth: (courtId: string, latency: number, success: boolean) => void;
  runInitialHealthCheck: (protocols: string[]) => Promise<void>;
  addLog: (log: ScanLog) => void;
}

let pollTimer: NodeJS.Timeout | null = null;

export const useDataJudScanStore = create<DataJudScanState>((set, get) => ({
  status: 'idle',
  total: 0,
  done: 0,
  alerts: 0,
  cloudDjenAlerts: 0,
  closed: 0,
  pending: 0,
  cycles: 0,

  manualStatus: 'idle',
  manualTotal: 0,
  manualDone: 0,
  manualAlerts: 0,
  manualClosed: 0,
  manualDjenAlerts: 0,
  manualErrors: 0,
  lastLogs: [],

  scanMode: 'datajud',
  setScanMode: (scanMode) => set({ scanMode }),
  
  includeDjen24h: false,
  setIncludeDjen24h: (includeDjen24h) => set({ includeDjen24h }),

  isMinimized: true,
  courtHealthMap: {},

  toggleMinimize: () => set((state) => ({ isMinimized: !state.isMinimized })),

  addLog: (log) => set(state => {
    const filtered = state.lastLogs.filter(l => l.protocolo !== log.protocolo || l.engine !== log.engine);
    return { lastLogs: [log, ...filtered].slice(0, 50) };
  }),

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
      const newAvgLatency = current.totalCalls === 0 ? latency : (current.avgLatency * 0.7) + (latency * 0.3);
      let newStatus: 'online' | 'slow' | 'offline' = 'online';
      if (newRate < 0.4) newStatus = 'offline';
      else if (newAvgLatency > 15000 || newRate < 0.7) newStatus = 'slow';
      return {
        courtHealthMap: {
          ...state.courtHealthMap,
          [courtId]: { ...current, totalCalls: newTotal, successCalls: newSuccess, successRate: newRate, avgLatency: newAvgLatency, status: newStatus }
        }
      };
    });
  },

  runInitialHealthCheck: async (protocols) => {
    // Implementação simplificada para auditoria inicial de latência
    for (const proto of protocols.slice(0, 10)) {
      const start = Date.now();
      const res = await scanOneDataJudAction(proto, true);
      const latency = Date.now() - start;
      const courtId = proto.split('.')[4];
      if (courtId) get().updateCourtHealth(courtId, latency, res.success);
    }
  },

  startCloudScan: () => {
    set({ status: 'running', isMinimized: false, cycles: 0 });
    if (pollTimer) clearInterval(pollTimer);
    
    get().pollStatus();
    pollTimer = setInterval(() => {
      get().pollStatus();
    }, 10000); 
  },

  pauseCloudScan: () => {
    set({ status: 'paused' });
    if (pollTimer) clearInterval(pollTimer);
  },

  startManualScan: async () => {
    const mode = get().scanMode;
    const cases = useAppStore.getState().cases.filter(c => !isCasoEncerrado(c));
    if (cases.length === 0) return;

    set({ manualStatus: 'running', manualTotal: cases.length, manualDone: 0, manualAlerts: 0, manualClosed: 0, manualDjenAlerts: 0, manualErrors: 0 });

    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    for (const c of cases) {
      if (get().manualStatus !== 'running') break;
      
      let itemLatency = 0;
      let itemSuccess = true;
      let combinedMessage = "";
      let logType: ScanLog['type'] = 'ok';

      // --- PASSO 1: DATAJUD ---
      if (mode === 'datajud' || mode === 'both') {
        const startDj = Date.now();
        const resDj = await scanOneDataJudAction(c.protocolo, true);
        const latDj = Date.now() - startDj;
        itemLatency += latDj;

        if (resDj.success) {
          const isUpdate = !!resDj.casePatch?.tem_atualizacao_pos_retorno;
          const isClosed = !!resDj.casePatch?.datajud_encerrado_tribunal;
          
          if (isUpdate) set(s => ({ manualAlerts: s.manualAlerts + 1 }));
          if (isClosed) set(s => ({ manualClosed: s.manualClosed + 1 }));
          
          combinedMessage = isClosed ? 'BAIXA NO TRIBUNAL' : isUpdate ? 'NOVA MOVIMENTAÇÃO' : 'Sem Alterações';
          logType = isClosed ? 'closed' : isUpdate ? 'update' : 'ok';
        } else {
          itemSuccess = false;
          combinedMessage = "[DataJud] " + (resDj.message || "Falha");
        }
      }

      // --- PASSO 2: DJEN ---
      if (itemSuccess && (mode === 'djen' || mode === 'both')) {
        if (mode === 'both') await new Promise(r => setTimeout(r, 800)); // Delay seguro

        const startDjen = Date.now();
        const resDjen = await scanOneDjenAction(c.protocolo, { dataInicio: yesterday, dataFim: today });
        const latDjen = Date.now() - startDjen;
        itemLatency += latDjen;

        if (resDjen.success) {
          const isNewDjen = !!resDjen.casePatch?.djen_nova_comunicacao;
          if (isNewDjen) {
            set(s => ({ manualDjenAlerts: s.manualDjenAlerts + 1 }));
            combinedMessage = (combinedMessage ? combinedMessage + " + " : "") + "PUBLICAÇÃO DJEN";
            logType = 'update';
          } else if (mode === 'djen') {
            combinedMessage = "Sem Publicações (24h)";
          }
        } else {
          // Se falha no DJEN mas DataJud foi ok no modo 'both', não invalida o item
          if (mode === 'djen') {
            itemSuccess = false;
            combinedMessage = "[DJEN] " + (resDjen.message || "Falha");
          } else {
            combinedMessage += " | [DJEN Fail]";
          }
        }
      }

      get().addLog({ 
        protocolo: c.protocolo, 
        message: combinedMessage || "Processado", 
        latency: itemLatency, 
        success: itemSuccess,
        type: logType,
        engine: 'Local'
      });
      
      set(s => ({ manualDone: s.manualDone + 1 }));
      
      const courtId = c.protocolo.split('.')[4];
      if (courtId) get().updateCourtHealth(courtId, itemLatency, itemSuccess);

      await new Promise(r => setTimeout(r, 600)); 
    }

    if (get().manualStatus === 'running') set({ manualStatus: 'done' });
  },

  pauseManualScan: () => set({ manualStatus: 'paused' }),

  resetScan: () => {
    if (pollTimer) clearInterval(pollTimer);
    set({ 
      status: 'idle', total: 0, done: 0, alerts: 0, cloudDjenAlerts: 0, closed: 0, pending: 0, cycles: 0,
      manualStatus: 'idle', manualDone: 0, manualTotal: 0, manualErrors: 0, manualAlerts: 0, manualClosed: 0, manualDjenAlerts: 0, lastLogs: []
    });
  },

  pollStatus: async () => {
    if (get().status !== 'running') return;

    try {
      set(s => ({ cycles: s.cycles + 1 }));
      fetch('/api/datajud-trigger', { method: 'POST' }).catch(() => {});

      const res = await fetch('/api/datajud-status');
      if (!res.ok) throw new Error();
      const metrics = await res.json();

      set({
        total: metrics.total,
        done: metrics.audited,
        pending: metrics.pending,
        alerts: metrics.alerts,
        cloudDjenAlerts: metrics.djenAlerts,
        closed: metrics.closed
      });

      if (metrics.recentLogs && metrics.recentLogs.length > 0) {
        metrics.recentLogs.forEach((log: ScanLog) => get().addLog(log));
      }

      if (metrics.pending === 0 && metrics.total > 0) {
        set({ status: 'done' });
        if (pollTimer) clearInterval(pollTimer);
      }
    } catch (e) {
      console.warn("[Cloud Polling Error]");
    }
  }
}));
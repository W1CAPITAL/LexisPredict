
/**
 * @copyright 2026 Davi Alves Figueredo / W1 Capital Assessoria Financeira Ltda.
 * MOTOR DE ESTADO GLOBAL v200.0 (ZUSTAND SLICES)
 * Arquitetura de Elite: UI persistente, Dados em memória, Supabase como Fonte de Verdade.
 */
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { LegalCase, CaseNote } from '@/lib/case-logic';
import { Locale } from '@/lib/i18n';

interface AppState {
  // --- UI & THEME (Persisted) ---
  locale: Locale;
  theme: string;
  isDarkMode: boolean;
  
  // --- DATA (Memory Only) ---
  cases: LegalCase[];
  notes: CaseNote[];
  
  // --- SYNC STATUS ---
  sync: {
    lastSync: string | null;
    isSyncing: boolean;
    lastSuccess: string | null;
    lastError: string | null;
  };
  
  // --- AI INTELLIGENCE ---
  ai: {
    online: boolean;
    loading: boolean;
    totalTokens: number;
    totalCalls: number;
    lastLatency: number;
    lastError: string | null;
  };
  
  // --- TUTORIAL / ONBOARDING (Persisted) ---
  tutorialCompleted: boolean;
  isTutorialActive: boolean;
  tutorialStep: number;
  
  // --- GLOBAL LOADING ---
  loading: {
    cases: boolean;
    team: boolean;
    dashboard: boolean;
    chatbot: boolean;
    import: boolean;
  };
  
  // --- PERSISTENT FILTERS ---
  filters: {
    tribunal: string;
    lawyer: string;
    status: string;
    search: string;
  };

  // --- USER PREFERENCES (Persisted) ---
  preferences: {
    compactView: boolean;
    autoRefresh: boolean;
    realtime: boolean;
    animations: boolean;
  };

  // --- ACTIONS ---
  
  // UI Actions
  setLocale: (locale: Locale) => void;
  setTheme: (theme: string) => void;
  setDarkMode: (isDark: boolean) => void;
  
  // Data Actions (with Integrity Check)
  setCases: (cases: LegalCase[]) => void;
  addCase: (item: LegalCase) => void;
  updateCase: (id: string, updates: Partial<LegalCase>) => void;
  updateCaseByProtocolo: (protocolo: string, patch: Partial<LegalCase>) => void;
  removeCase: (id: string) => void;
  
  setNotes: (notes: CaseNote[]) => void;
  addNote: (note: CaseNote) => void;
  removeNote: (id: string) => void;

  // Sync Actions
  setSyncStatus: (updates: Partial<AppState['sync']>) => void;
  updateLastSync: () => void;
  
  // AI Actions
  addAiMetrics: (tokens: number, latency: number) => void;
  setAiStatus: (updates: Partial<AppState['ai']>) => void;

  // Tutorial Actions
  setTutorialCompleted: (completed: boolean) => void;
  setTutorialActive: (active: boolean) => void;
  setTutorialStep: (step: number) => void;
  
  // Utility Actions
  setLoading: (key: keyof AppState['loading'], value: boolean) => void;
  setFilter: (key: keyof AppState['filters'], value: string) => void;
  setPreference: (key: keyof AppState['preferences'], value: boolean) => void;
  
  clearState: () => void;
}

/**
 * Deduplicação de Registros Forenses
 */
const dedupe = <T extends { id: string | number }>(items: T[]): T[] => {
  const map = new Map();
  items.forEach(item => map.set(item.id, item));
  return Array.from(map.values());
};

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      // Initial States
      locale: 'pt',
      theme: 'white-prestige',
      isDarkMode: false,
      cases: [],
      notes: [],
      sync: {
        lastSync: null,
        isSyncing: false,
        lastSuccess: null,
        lastError: null,
      },
      ai: {
        online: true,
        loading: false,
        totalTokens: 0,
        totalCalls: 0,
        lastLatency: 0,
        lastError: null,
      },
      tutorialCompleted: false,
      isTutorialActive: false,
      tutorialStep: 0,
      loading: {
        cases: false,
        team: false,
        dashboard: false,
        chatbot: false,
        import: false,
      },
      filters: {
        tribunal: 'ALL',
        lawyer: 'ALL',
        status: 'ALL',
        search: '',
      },
      preferences: {
        compactView: false,
        autoRefresh: true,
        realtime: true,
        animations: true,
      },

      // UI Actions
      setLocale: (locale) => set({ locale }),
      setTheme: (theme) => set({ theme }),
      setDarkMode: (isDarkMode) => {
        set({ isDarkMode });
        if (typeof document !== 'undefined') {
          if (isDarkMode) document.documentElement.classList.add('dark');
          else document.documentElement.classList.remove('dark');
          localStorage.setItem('lexis_dark_mode', String(isDarkMode));
        }
      },

      // Data Actions
      setCases: (cases) => set({ cases: dedupe(cases) }),
      addCase: (item) => set((state) => ({ cases: dedupe([item, ...state.cases]) })),
      updateCase: (id, updates) => set((state) => ({
        cases: state.cases.map(c => c.id === id ? { ...c, ...updates } : c)
      })),
      updateCaseByProtocolo: (protocolo, patch) => set((state) => ({
        cases: state.cases.map(c => c.protocolo === protocolo ? { ...c, ...patch } : c)
      })),
      removeCase: (id) => set((state) => ({
        cases: state.cases.filter(c => c.id !== id)
      })),

      setNotes: (notes) => set({ notes: dedupe(notes) }),
      addNote: (note) => set((state) => ({ notes: dedupe([note, ...state.notes]) })),
      removeNote: (id) => set((state) => ({
        notes: state.notes.filter(n => n.id !== id)
      })),

      // Sync Actions
      setSyncStatus: (updates) => set((state) => ({ sync: { ...state.sync, ...updates } })),
      updateLastSync: () => set((state) => ({ 
        sync: { ...state.sync, lastSync: new Date().toISOString(), lastSuccess: new Date().toISOString() } 
      })),

      // AI Actions
      addAiMetrics: (tokens, latency) => set((state) => ({
        ai: {
          ...state.ai,
          totalTokens: state.ai.totalTokens + tokens,
          totalCalls: state.ai.totalCalls + 1,
          lastLatency: latency
        }
      })),
      setAiStatus: (updates) => set((state) => ({ ai: { ...state.ai, ...updates } })),

      // Tutorial Actions
      setTutorialCompleted: (tutorialCompleted) => set({ tutorialCompleted }),
      setTutorialActive: (isTutorialActive) => set({ isTutorialActive }),
      setTutorialStep: (tutorialStep) => set({ tutorialStep }),

      // Utils
      setLoading: (key, value) => set((state) => ({ loading: { ...state.loading, [key]: value } })),
      setFilter: (key, value) => set((state) => ({ filters: { ...state.filters, [key]: value } })),
      setPreference: (key, value) => set((state) => ({ preferences: { ...state.preferences, [key]: value } })),

      clearState: () => set({ 
        cases: [], 
        notes: [], 
        sync: { lastSync: null, isSyncing: false, lastSuccess: null, lastError: null },
        ai: { online: true, loading: false, totalTokens: 0, totalCalls: 0, lastLatency: 0, lastError: null },
        tutorialStep: 0 
      }),
    }),
    {
      name: 'lexispredict-enterprise-v6',
      storage: createJSONStorage(() => localStorage),
      version: 6,
      // PONTO CRÍTICO: Persiste apenas UI e Preferências. Dados pesados ficam em memória.
      partialize: (state) => ({
        locale: state.locale,
        theme: state.theme,
        isDarkMode: state.isDarkMode,
        tutorialCompleted: state.tutorialCompleted,
        tutorialStep: state.tutorialStep,
        filters: state.filters,
        preferences: state.preferences,
      }),
      migrate: (persistedState: any, version: number) => {
        if (version < 6) {
          // Reset de cache para nova estrutura de slices
          return {
            ...persistedState,
            filters: { tribunal: 'ALL', lawyer: 'ALL', status: 'ALL', search: '' },
            preferences: { compactView: false, autoRefresh: true, realtime: true, animations: true }
          };
        }
        return persistedState;
      },
    }
  )
);

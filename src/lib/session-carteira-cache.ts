/**
 * Cache de sessão da carteira — UX rápida sem poluir KPI.
 *
 * Regras:
 * 1) Cache só para abrir lista na hora (sessionStorage).
 * 2) Rede SEMPRE substitui o cache (replace), nunca concatena cache+nuvem.
 * 3) KPI / ranking / relatório devem preferir dados com source === "network".
 * 4) Após save/atendimento: invalidate + opcional write do estado novo.
 * 5) Scanner: progresso em chave separada; fila usa store já hidratada, não soma contadores.
 */
const CARTEIRA_KEY = 'lexis_carteira_sessao_v3';
const SCAN_KEY = 'lexis_scan_progress_v1';
const TTL_MS = 4 * 60 * 1000; // 4 min — lista ok; KPI revalida em background

export type CacheSource = 'cache' | 'network' | 'empty';

type CarteiraPayload = {
  v: 2;
  at: number;
  empresaId?: string | null;
  cases: unknown[];
};

type ScanProgress = {
  manualDone: number;
  manualTotal: number;
  mode?: string;
  at: number;
};

function canUse(): boolean {
  return typeof window !== 'undefined' && typeof sessionStorage !== 'undefined';
}

export function readCarteiraCache(empresaId?: string | null): {
  cases: any[];
  ageMs: number;
  stale: boolean;
} | null {
  if (!canUse()) return null;
  try {
    const raw = sessionStorage.getItem(CARTEIRA_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as CarteiraPayload;
    if (!p || p.v !== 2 || !Array.isArray(p.cases)) return null;
    if (empresaId && p.empresaId && p.empresaId !== empresaId) return null;
    const ageMs = Date.now() - (p.at || 0);
    return { cases: p.cases, ageMs, stale: ageMs > TTL_MS };
  } catch {
    return null;
  }
}

/** Grava snapshot único (replace total). */
export function writeCarteiraCache(cases: unknown[], empresaId?: string | null) {
  if (!canUse()) return;
  try {
    const payload: CarteiraPayload = {
      v: 2,
      at: Date.now(),
      empresaId: empresaId || null,
      // não guarda 10k blobs: o array já deve vir enxuto do servidor
      cases: Array.isArray(cases) ? cases.slice(0, 5000) : [],
    };
    sessionStorage.setItem(CARTEIRA_KEY, JSON.stringify(payload));
  } catch {
    /* quota */
  }
}

export function invalidateCarteiraCache() {
  if (!canUse()) return;
  try {
    sessionStorage.removeItem(CARTEIRA_KEY);
  } catch {
    /* */
  }
}

export function readScanProgress(): ScanProgress | null {
  if (!canUse()) return null;
  try {
    const raw = sessionStorage.getItem(SCAN_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as ScanProgress;
    if (!p || typeof p.manualDone !== 'number') return null;
    // progresso vale 12h
    if (Date.now() - (p.at || 0) > 12 * 60 * 60 * 1000) return null;
    return p;
  } catch {
    return null;
  }
}

export function writeScanProgress(done: number, total: number, mode?: string) {
  if (!canUse()) return;
  try {
    sessionStorage.setItem(
      SCAN_KEY,
      JSON.stringify({ manualDone: done, manualTotal: total, mode, at: Date.now() } satisfies ScanProgress)
    );
  } catch {
    /* */
  }
}

export function clearScanProgress() {
  if (!canUse()) return;
  try {
    sessionStorage.removeItem(SCAN_KEY);
  } catch {
    /* */
  }
}

/**
 * Carrega carteira: pinta cache na hora, busca rede, SUBSTITUI (não soma).
 * onKpiSafe = só chama com dados de rede (ou cache se rede falhar e allowStaleKpi).
 */
export async function loadCarteiraComCache(opts: {
  fetchNetwork: () => Promise<any[]>;
  empresaId?: string | null;
  onShow: (cases: any[], source: CacheSource) => void;
  /** KPIs / gráficos — só rede por padrão */
  onKpiSafe?: (cases: any[], source: 'network' | 'stale-fallback') => void;
  allowStaleKpiFallback?: boolean;
}): Promise<{ cases: any[]; source: CacheSource }> {
  const cached = readCarteiraCache(opts.empresaId);
  if (cached?.cases?.length) {
    opts.onShow(cached.cases, 'cache');
  }

  try {
    const remote = await opts.fetchNetwork();
    const list = Array.isArray(remote) ? remote : [];
    // REPLACE total — nunca [...cache, ...remote]
    writeCarteiraCache(list, opts.empresaId);
    opts.onShow(list, list.length ? 'network' : 'empty');
    opts.onKpiSafe?.(list, 'network');
    return { cases: list, source: list.length ? 'network' : 'empty' };
  } catch (e) {
    if (cached?.cases?.length) {
      if (opts.allowStaleKpiFallback) {
        opts.onKpiSafe?.(cached.cases, 'stale-fallback');
      }
      return { cases: cached.cases, source: 'cache' };
    }
    opts.onShow([], 'empty');
    return { cases: [], source: 'empty' };
  }
}

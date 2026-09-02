/**
 * Cache persistente da carteira: a lista aparece imediatamente após trocar de aba/F5.
 * A rede é apenas revalidação em segundo plano; nunca bloqueia a pintura do cache.
 */
const CARTEIRA_KEY = 'lexis_carteira_persistente_v4';
const LEGACY_KEY = 'lexis_carteira_sessao_v3';
const SCAN_KEY = 'lexis_scan_progress_v1';
const TTL_MS = 30 * 60 * 1000;
export type CacheSource = 'cache' | 'network' | 'empty';

type CarteiraPayload = { v: 4; at: number; empresaId?: string | null; cases: unknown[] };
type ScanProgress = { manualDone: number; manualTotal: number; mode?: string; at: number };
function canUse() { return typeof window !== 'undefined' && typeof localStorage !== 'undefined'; }
function storage(): Storage | null { if (!canUse()) return null; return localStorage; }
export function readCarteiraCache(empresaId?: string | null) {
  const s = storage(); if (!s) return null;
  try {
    const raw = s.getItem(CARTEIRA_KEY) || s.getItem(LEGACY_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as CarteiraPayload;
    if (!p || !Array.isArray(p.cases)) return null;
    if (empresaId && p.empresaId && p.empresaId !== empresaId) return null;
    return { cases: p.cases as any[], ageMs: Date.now() - (p.at || 0), stale: Date.now() - (p.at || 0) > TTL_MS };
  } catch { return null; }
}
export function writeCarteiraCache(cases: unknown[], empresaId?: string | null) {
  const s = storage(); if (!s) return;
  try {
    s.setItem(CARTEIRA_KEY, JSON.stringify({ v: 4, at: Date.now(), empresaId: empresaId || null, cases: Array.isArray(cases) ? cases.slice(0, 5000) : [] } satisfies CarteiraPayload));
  } catch { /* quota: cache é somente UX */ }
}
export function invalidateCarteiraCache() { const s = storage(); if (!s) return; try { s.removeItem(CARTEIRA_KEY); s.removeItem(LEGACY_KEY); } catch {} }
export function readScanProgress(): ScanProgress | null { const s=storage(); if(!s) return null; try { const p=JSON.parse(s.getItem(SCAN_KEY)||'null'); if(!p||typeof p.manualDone!=='number'||Date.now()-(p.at||0)>12*60*60*1000)return null; return p;}catch{return null;} }
export function writeScanProgress(done:number,total:number,mode?:string){const s=storage();if(!s)return;try{s.setItem(SCAN_KEY,JSON.stringify({manualDone:done,manualTotal:total,mode,at:Date.now()}));}catch{}}
export function clearScanProgress(){const s=storage();if(!s)return;try{s.removeItem(SCAN_KEY);}catch{}}

export async function loadCarteiraComCache(opts: {
  fetchNetwork: () => Promise<any[]>;
  empresaId?: string | null;
  onShow: (cases: any[], source: CacheSource) => void;
  onKpiSafe?: (cases: any[], source: 'network' | 'stale-fallback') => void;
  allowStaleKpiFallback?: boolean;
}): Promise<{ cases: any[]; source: CacheSource }> {
  const cached = readCarteiraCache(opts.empresaId);
  if (cached?.cases?.length) opts.onShow(cached.cases, 'cache');
  // Rede nunca bloqueia a UI. O caller pode continuar renderizando o cache.
  try {
    const remote = await opts.fetchNetwork();
    const list = Array.isArray(remote) ? remote : [];
    if (list.length) {
      writeCarteiraCache(list, opts.empresaId);
      opts.onShow(list, 'network');
      opts.onKpiSafe?.(list, 'network');
      return { cases: list, source: 'network' };
    }
    if (cached?.cases?.length) {
      opts.onKpiSafe?.(cached.cases, 'stale-fallback');
      return { cases: cached.cases, source: 'cache' };
    }
    opts.onShow([], 'empty');
    return { cases: [], source: 'empty' };
  } catch {
    if (cached?.cases?.length) {
      if (opts.allowStaleKpiFallback) opts.onKpiSafe?.(cached.cases, 'stale-fallback');
      return { cases: cached.cases, source: 'cache' };
    }
    opts.onShow([], 'empty'); return { cases: [], source: 'empty' };
  }
}

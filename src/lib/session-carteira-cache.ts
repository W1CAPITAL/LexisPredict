const CARTEIRA_KEY = "lexis_carteira_persistente_v5";
const LEGACY_KEYS = ["lexis_carteira_persistente_v4", "lexis_carteira_sessao_v3"];
const SCAN_KEY = "lexis_scan_progress_v1";
const TTL_MS = 6 * 60 * 60 * 1000;

export type CacheSource = "cache" | "network" | "empty";
export type CarteiraScope = "mine" | "empresa";

type CarteiraPayload = {
  v: 5;
  at: number;
  empresaId?: string | null;
  scope?: CarteiraScope;
  cases: unknown[];
};

type ScanProgress = { manualDone: number; manualTotal: number; mode?: string; at: number };

const memory = new Map<string, CarteiraPayload>();

function memKey(empresaId?: string | null, scope: CarteiraScope = "mine") {
  return `${scope}:${empresaId || "*"}`;
}

function canUse() {
  return typeof window !== "undefined" && typeof localStorage !== "undefined";
}

function storage(): Storage | null {
  if (!canUse()) return null;
  return localStorage;
}

export function peekCarteiraCache(empresaId?: string | null, scope: CarteiraScope = "mine") {
  const k = memKey(empresaId, scope);
  const hit = memory.get(k);
  if (hit?.cases?.length) return { cases: hit.cases as any[], ageMs: Date.now() - (hit.at || 0), stale: false };
  return readCarteiraCache(empresaId, scope);
}

export function readCarteiraCache(empresaId?: string | null, scope: CarteiraScope = "mine") {
  const k = memKey(empresaId, scope);
  const mem = memory.get(k);
  if (mem?.cases) {
    return { cases: mem.cases as any[], ageMs: Date.now() - (mem.at || 0), stale: Date.now() - (mem.at || 0) > TTL_MS };
  }
  const s = storage();
  if (!s) return null;
  try {
    const raw = s.getItem(`${CARTEIRA_KEY}:${scope}`) || s.getItem(CARTEIRA_KEY) || LEGACY_KEYS.map((x) => s.getItem(x)).find(Boolean);
    if (!raw) return null;
    const p = JSON.parse(raw) as CarteiraPayload;
    if (!p || !Array.isArray(p.cases)) return null;
    if (empresaId && p.empresaId && p.empresaId !== empresaId) return null;
    if (p.scope && p.scope !== scope && scope === "empresa") return null;
    memory.set(k, p);
    return { cases: p.cases as any[], ageMs: Date.now() - (p.at || 0), stale: Date.now() - (p.at || 0) > TTL_MS };
  } catch {
    return null;
  }
}

export function writeCarteiraCache(
  cases: unknown[],
  empresaId?: string | null,
  scope: CarteiraScope = "mine"
) {
  const payload: CarteiraPayload = {
    v: 5,
    at: Date.now(),
    empresaId: empresaId || null,
    scope,
    cases: Array.isArray(cases) ? cases.slice(0, 5000) : [],
  };
  memory.set(memKey(empresaId, scope), payload);
  const s = storage();
  if (!s) return;
  try {
    s.setItem(`${CARTEIRA_KEY}:${scope}`, JSON.stringify(payload));
  } catch {
    /* quota */
  }
}

export function invalidateCarteiraCache() {
  memory.clear();
  const s = storage();
  if (!s) return;
  try {
    s.removeItem(CARTEIRA_KEY);
    s.removeItem(`${CARTEIRA_KEY}:mine`);
    s.removeItem(`${CARTEIRA_KEY}:empresa`);
    LEGACY_KEYS.forEach((k) => s.removeItem(k));
  } catch {}
}

export function readScanProgress(): ScanProgress | null {
  const s = storage();
  if (!s) return null;
  try {
    const p = JSON.parse(s.getItem(SCAN_KEY) || "null");
    if (!p || typeof p.manualDone !== "number" || Date.now() - (p.at || 0) > 12 * 60 * 60 * 1000) return null;
    return p;
  } catch {
    return null;
  }
}

export function writeScanProgress(done: number, total: number, mode?: string) {
  const s = storage();
  if (!s) return;
  try {
    s.setItem(SCAN_KEY, JSON.stringify({ manualDone: done, manualTotal: total, mode, at: Date.now() }));
  } catch {}
}

export function clearScanProgress() {
  const s = storage();
  if (!s) return;
  try {
    s.removeItem(SCAN_KEY);
  } catch {}
}

export async function loadCarteiraComCache(opts: {
  fetchNetwork: () => Promise<any[]>;
  empresaId?: string | null;
  scope?: CarteiraScope;
  onShow: (cases: any[], source: CacheSource) => void;
  onKpiSafe?: (cases: any[], source: "network" | "stale-fallback") => void;
  allowStaleKpiFallback?: boolean;
}): Promise<{ cases: any[]; source: CacheSource }> {
  const scope = opts.scope || "mine";
  const cached = peekCarteiraCache(opts.empresaId, scope);
  if (cached?.cases?.length) opts.onShow(cached.cases, "cache");

  try {
    const remote = await opts.fetchNetwork();
    const list = Array.isArray(remote) ? remote : [];
    if (list.length) {
      writeCarteiraCache(list, opts.empresaId, scope);
      opts.onShow(list, "network");
      opts.onKpiSafe?.(list, "network");
      return { cases: list, source: "network" };
    }
    if (cached?.cases?.length) {
      opts.onKpiSafe?.(cached.cases, "stale-fallback");
      return { cases: cached.cases, source: "cache" };
    }
    opts.onShow([], "empty");
    return { cases: [], source: "empty" };
  } catch {
    if (cached?.cases?.length) {
      if (opts.allowStaleKpiFallback) opts.onKpiSafe?.(cached.cases, "stale-fallback");
      return { cases: cached.cases, source: "cache" };
    }
    opts.onShow([], "empty");
    return { cases: [], source: "empty" };
  }
}

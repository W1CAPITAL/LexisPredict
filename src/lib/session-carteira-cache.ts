const CARTEIRA_KEY = "lexis_carteira_persistente_v6";
const LEGACY_KEYS = ["lexis_carteira_persistente_v4", "lexis_carteira_sessao_v3"];
const SCAN_KEY = "lexis_scan_progress_v1";
const TTL_MS = 10 * 60 * 1000;
const SESSION_ROWS = 60;
const SESSION_BYTES = 350_000;

export type CacheSource = "cache" | "network" | "empty";
export type CarteiraScope = "mine" | "empresa";

type CarteiraPayload = {
  v: 6;
  complete: boolean;
  at: number;
  empresaId?: string | null;
  scope?: CarteiraScope;
  cases: unknown[];
};

type ScanProgress = { manualDone: number; manualTotal: number; mode?: string; at: number };

const memory = new Map<string, CarteiraPayload>();

function memKey(empresaId?: string | null, scope: CarteiraScope = "mine", userId?: string | null, viewKey = "list") {
  // Inclui usuario em todos os escopos: nenhum cache empresarial e compartilhado entre logins.
  return `${scope}:${empresaId || "*"}:${userId || "unknown"}:${viewKey}`;
}

function canUse() {
  return typeof window !== "undefined" && typeof localStorage !== "undefined";
}

function storage(): Storage | null {
  if (!canUse()) return null;
  return localStorage;
}

function sessionKey(empresaId: string, scope: CarteiraScope, userId: string, viewKey: string) {
  return CARTEIRA_KEY + ":" + memKey(empresaId, scope, userId, viewKey);
}
function readSession(empresaId: string, scope: CarteiraScope, userId: string, viewKey: string): CarteiraPayload | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(sessionKey(empresaId, scope, userId, viewKey));
    if (!raw) return null;
    const payload = JSON.parse(raw) as CarteiraPayload;
    if (payload.v !== 6 || payload.empresaId !== empresaId || payload.scope !== scope ||
        !Array.isArray(payload.cases) || Date.now() - payload.at > TTL_MS) return null;
    return payload;
  } catch { return null; }
}

export function peekCarteiraCache(
  empresaId?: string | null, scope: CarteiraScope = "mine",
  userId?: string | null, viewKey = "list"
) {
  return readCarteiraCache(empresaId, scope, userId, viewKey);
}

export function readCarteiraCache(
  empresaId?: string | null, scope: CarteiraScope = "mine",
  userId?: string | null, viewKey = "list"
) {
  if (!empresaId || !userId) return null;
  const key = memKey(empresaId, scope, userId, viewKey);
  const cached = memory.get(key) || readSession(empresaId, scope, userId, viewKey);
  if (!cached || !cached.cases.length) return null;
  memory.set(key, cached);
  return { cases: cached.cases as any[], ageMs: Date.now() - cached.at,
    stale: Date.now() - cached.at > TTL_MS, complete: cached.complete };
}

export function writeCarteiraCache(
  cases: unknown[], empresaId?: string | null, scope: CarteiraScope = "mine",
  userId?: string | null, viewKey = "list"
) {
  if (!empresaId || !userId) return;
  const list = Array.isArray(cases) ? cases.slice(0, 10000) : [];
  const payload: CarteiraPayload = {
    v: 6, at: Date.now(), empresaId, scope, complete: true, cases: list,
  };
  memory.set(memKey(empresaId, scope, userId, viewKey), payload);
  // Session storage reapresenta a PRIMEIRA pagina apos refresh. Apenas uma
  // amostra pequena: nunca serializar milhares de processos no thread da UI.
  if (typeof window === 'undefined' || !list.length) return;
  try {
    const snapshot: CarteiraPayload = { ...payload,
      complete: list.length <= SESSION_ROWS,
      cases: list.slice(0, SESSION_ROWS),
    };
    const encoded = JSON.stringify(snapshot);
    if (encoded.length < SESSION_BYTES) {
      sessionStorage.setItem(sessionKey(empresaId, scope, userId, viewKey), encoded);
    }
  } catch { /* armazenamento cheio/indisponivel: cache em memoria continua valido */ }
}

export function invalidateCarteiraCache() {
  memory.clear();
  const s = storage();
  if (s) {
    try {
      s.removeItem(CARTEIRA_KEY);
      LEGACY_KEYS.forEach((k) => s.removeItem(k));
    } catch {}
  }
  if (typeof window !== 'undefined') {
    try {
      for (let i = sessionStorage.length - 1; i >= 0; i--) {
        const key = sessionStorage.key(i);
        if (key?.startsWith(CARTEIRA_KEY + ':')) sessionStorage.removeItem(key);
      }
    } catch {}
  }
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
  userId?: string | null;
  onShow: (cases: any[], source: CacheSource) => void;
  onError?: (error: unknown) => void;
  onKpiSafe?: (cases: any[], source: "network" | "stale-fallback") => void;
  allowStaleKpiFallback?: boolean;
  viewKey?: string;
  reuseFreshCache?: boolean;
  maxAgeMs?: number;
}): Promise<{ cases: any[]; source: CacheSource }> {
  const scope = opts.scope || "mine";
  const viewKey = opts.viewKey || "list";
  const cached = peekCarteiraCache(opts.empresaId, scope, opts.userId, viewKey);
  if (cached?.cases?.length) {
    opts.onShow(cached.cases, "cache");
    // A lista completa, ja carregada nesta aba, nao precisa de nova varredura
    // quando o operador navega entre telas. Cache parcial sempre revalida.
    if (opts.reuseFreshCache && cached.complete && cached.ageMs < (opts.maxAgeMs ?? 2 * 60 * 1000)) {
      return { cases: cached.cases, source: "cache" };
    }
  }

  try {
    const remote = await opts.fetchNetwork();
    const list = Array.isArray(remote) ? remote : [];
    if (list.length) {
      writeCarteiraCache(list, opts.empresaId, scope, opts.userId, viewKey);
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
  } catch (error) {
    opts.onError?.(error);
    if (cached?.cases?.length) {
      if (opts.allowStaleKpiFallback) opts.onKpiSafe?.(cached.cases, "stale-fallback");
      return { cases: cached.cases, source: "cache" };
    }
    opts.onShow([], "empty");
    return { cases: [], source: "empty" };
  }
}

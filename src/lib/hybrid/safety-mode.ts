/** Modo segurança: planilha Usuarios quando o Postgres/Supabase cai. */

export const SAFETY_SESSION_KEY = "lexis_safety_session_v1";
export const SAFETY_QUEUE_KEY = "lexis_safety_queue_v1";
export const SAFETY_FLAG_KEY = "lexis_safety_mode_v1";

export type SafetyUser = {
  login: string;
  nome: string;
  perfil: string;
  escritorio?: string;
  email?: string;
  token?: string;
};

export type SafetySession = {
  active: boolean;
  reason: string;
  user: SafetyUser;
  at: string;
};

export function isQuotaOrBillingError(msg?: string | null) {
  const s = String(msg || "").toLowerCase();
  return /quota|billing|payment|organization has used up|over_quota|project paused|failed to fetch|network error|err_name_not_resolved/.test(s);
}

export function loadSafetySession(): SafetySession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(SAFETY_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SafetySession;
    if (!parsed?.active || !parsed?.user?.login) return null;
    return parsed;
  } catch {
    return null;
  }
}

function cookieSecure() {
  return typeof window !== "undefined" && window.location.protocol === "https:" ? "; secure" : "";
}

function writeCookie(name: string, value: string, maxAge = 60 * 60 * 24 * 7) {
  if (typeof document === "undefined") return;
  const v = encodeURIComponent(String(value || "").slice(0, 180));
  document.cookie = `${name}=${v}; path=/; max-age=${maxAge}; samesite=lax${cookieSecure()}`;
}

function clearCookie(name: string) {
  if (typeof document === "undefined") return;
  document.cookie = `${name}=; path=/; max-age=0; samesite=lax`;
}

/** Cookies que o middleware lê. Sem isso o app volta para /login e trava no splash. */
export function writeSafetyCookies(user: SafetyUser) {
  writeCookie("lexis_safety", "1");
  writeCookie("lexis_user_email", user.email || user.login);
  writeCookie("lexis_safety_login", user.login);
  writeCookie("lexis_safety_nome", user.nome || user.login);
  writeCookie("lexis_user_role", perfilToCargo(user.perfil));
  if (user.email) writeCookie("lexis_user_email", user.email);
}

export function saveSafetySession(sess: SafetySession) {
  if (typeof window === "undefined") return;
  localStorage.setItem(SAFETY_SESSION_KEY, JSON.stringify(sess));
  localStorage.setItem(SAFETY_FLAG_KEY, "1");
  writeSafetyCookies(sess.user);
}

export function clearSafetySession() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(SAFETY_SESSION_KEY);
  localStorage.removeItem(SAFETY_FLAG_KEY);
  ["lexis_safety", "lexis_safety_login", "lexis_safety_nome", "lexis_user_role"].forEach(clearCookie);
}

export function enqueueSafetyWrite(row: Record<string, unknown>) {
  if (typeof window === "undefined") return;
  const cur = loadSafetyQueue();
  cur.push({ at: new Date().toISOString(), row });
  localStorage.setItem(SAFETY_QUEUE_KEY, JSON.stringify(cur.slice(-400)));
}

export function loadSafetyQueue(): Array<{ at: string; row: Record<string, unknown> }> {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(SAFETY_QUEUE_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

export function clearSafetyQueue() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(SAFETY_QUEUE_KEY);
}

export function perfilToCargo(perfil?: string): "Superadmin" | "Administrador" | "Supervisor" | "Operador" {
  const p = String(perfil || "").toLowerCase();
  if (p.includes("super")) return "Superadmin";
  if (p.includes("admin")) return "Administrador";
  if (p.includes("superv")) return "Supervisor";
  return "Operador";
}

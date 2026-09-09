/**
 * Sherlock — busca de perfis públicos por username (opcional).
 * Env: SHERLOCK_ENABLED, SHERLOCK_API_URL, SHERLOCK_API_PATH, SHERLOCK_TIMEOUT_MS
 *
 * 127.0.0.1 só funciona em DEV local (sua máquina). No Vercel Production isso é o
 * próprio servidor Vercel, não o seu PC — use URL pública ou rode o app em localhost.
 */

export type SherlockHit = { site: string; url: string; username?: string };

export function sherlockEnabledFlag(): boolean {
  return ["1", "true", "yes", "on"].includes(
    String(process.env.SHERLOCK_ENABLED || "").toLowerCase()
  );
}

export function sherlockApiUrl(): string {
  return String(process.env.SHERLOCK_API_URL || "").replace(/\/$/, "").trim();
}

export function sherlockIsLocalhostUrl(url: string): boolean {
  try {
    const u = new URL(url.includes("://") ? url : `http://${url}`);
    return u.hostname === "127.0.0.1" || u.hostname === "localhost" || u.hostname === "::1";
  } catch {
    return /127\.0\.0\.1|localhost/i.test(url);
  }
}

export function sherlockConfigured(): boolean {
  return sherlockEnabledFlag() && !!sherlockApiUrl();
}

export function usernamesFromNome(nome: string): string[] {
  const n = String(nome || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (n.length < 4) return [];
  const parts = n.split(" ").filter((p) => p.length > 1 && !/^(da|de|do|das|dos|e)$/.test(p));
  if (!parts.length) return [];
  const first = parts[0];
  const last = parts[parts.length - 1];
  const mid = parts.length > 2 ? parts[1] : "";
  const cands = [
    first + last,
    `${first}.${last}`,
    `${first}_${last}`,
    first + last[0],
    first[0] + last,
    parts.join("."),
    parts.join(""),
    parts.join("_"),
  ];
  if (mid) cands.push(first + mid[0] + last, `${first}.${mid[0]}.${last}`);
  return [...new Set(cands.map((c) => c.replace(/\.{2,}/g, ".").slice(0, 32)))].slice(0, 8);
}

function normalizePayload(username: string, data: any): SherlockHit[] {
  const hits: SherlockHit[] = [];
  if (!data) return hits;
  const arr =
    data.results || data.sites || data.found || data.data || (Array.isArray(data) ? data : null);
  if (Array.isArray(arr)) {
    for (const row of arr) {
      const site = String(row.site || row.name || row.platform || "").trim();
      const url = String(row.url || row.link || row.profile || "").trim();
      if (url.startsWith("http")) hits.push({ site: site || "site", url, username });
    }
  } else if (typeof data === "object") {
    for (const [k, v] of Object.entries(data)) {
      if (typeof v === "string" && v.startsWith("http")) hits.push({ site: k, url: v, username });
      if (v && typeof v === "object" && String((v as any).url || "").startsWith("http")) {
        hits.push({ site: k, url: String((v as any).url), username });
      }
    }
  }
  return hits;
}

export async function sherlockLookupUsername(username: string): Promise<{
  ok: boolean;
  username: string;
  hits: SherlockHit[];
  error?: string;
}> {
  const base = sherlockApiUrl();
  if (!sherlockConfigured()) {
    return {
      ok: false,
      username,
      hits: [],
      error: "Sherlock desligado ou sem SHERLOCK_API_URL (opcional).",
    };
  }
  const pathTpl = String(process.env.SHERLOCK_API_PATH || "/api/v1/username/{username}");
  const url = `${base}${pathTpl.replace("{username}", encodeURIComponent(username))}`;
  const timeoutMs = Math.min(
    Math.max(parseInt(process.env.SHERLOCK_TIMEOUT_MS || "25000", 10) || 25000, 5000),
    90000
  );
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    let res = await fetch(url, {
      method: "GET",
      headers: { Accept: "application/json" },
      signal: controller.signal,
      cache: "no-store",
    });
    if (!res.ok) {
      res = await fetch(`${base}/api/sherlock`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ username }),
        signal: controller.signal,
        cache: "no-store",
      });
    }
    if (!res.ok) {
      return { ok: false, username, hits: [], error: `HTTP ${res.status}` };
    }
    const data = await res.json().catch(() => null);
    const hits = normalizePayload(username, data);
    return { ok: hits.length > 0, username, hits };
  } catch (e: any) {
    const msg =
      e?.name === "AbortError"
        ? "timeout"
        : /ECONNREFUSED|fetch failed|ENOTFOUND/i.test(String(e?.message || e))
          ? "API inacessível (no Vercel, 127.0.0.1 não é o seu PC)"
          : e?.message || "falha";
    return { ok: false, username, hits: [], error: msg };
  } finally {
    clearTimeout(t);
  }
}

export async function sherlockLookupNome(nome: string): Promise<{
  ok: boolean;
  tried: string[];
  hits: SherlockHit[];
  error?: string;
}> {
  const users = usernamesFromNome(nome);
  if (!users.length) return { ok: false, tried: [], hits: [], error: "Nome curto" };
  if (!sherlockConfigured()) {
    return {
      ok: false,
      tried: users,
      hits: [],
      error: "Opcional: defina SHERLOCK_ENABLED=true e SHERLOCK_API_URL",
    };
  }
  const all: SherlockHit[] = [];
  const errors: string[] = [];
  for (const u of users.slice(0, 3)) {
    const r = await sherlockLookupUsername(u);
    all.push(...r.hits);
    if (r.error) errors.push(`${u}: ${r.error}`);
    await new Promise((r) => setTimeout(r, 250));
  }
  return {
    ok: all.length > 0,
    tried: users,
    hits: all,
    error: all.length ? undefined : errors[0] || "0 perfis",
  };
}

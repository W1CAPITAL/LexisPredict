/**
 * Sherlock (gratuito) — busca perfis públicos por *username*.
 * Não descobre CPF/telefone. Só redes sociais a partir de handles derivados do nome.
 *
 * Self-host (grátis):
 *   git clone https://github.com/sherlock-project/api.git
 *   pip install -r requirements.txt && python manage.py runserver 0.0.0.0:8000
 *
 * Env:
 *   SHERLOCK_API_URL=http://127.0.0.1:8000   (ou sua VPS)
 *   SHERLOCK_ENABLED=true
 */

export type SherlockHit = {
  site: string;
  url: string;
};

export type SherlockResult = {
  ok: boolean;
  username: string;
  hits: SherlockHit[];
  error?: string;
  fonte: string;
};

export function sherlockConfigured(): boolean {
  const on = ["1", "true", "yes", "on"].includes(
    String(process.env.SHERLOCK_ENABLED || "").toLowerCase()
  );
  return on && !!String(process.env.SHERLOCK_API_URL || "").trim();
}

/** Gera handles plausíveis a partir do nome completo (sem inventar dado sensível). */
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
    first + "." + last,
    first + "_" + last,
    first + last[0],
    first[0] + last,
    parts.join("."),
    parts.join(""),
    parts.join("_"),
  ];
  if (mid) {
    cands.push(first + mid[0] + last, first + "." + mid[0] + "." + last);
  }
  return [...new Set(cands.map((c) => c.replace(/\.{2,}/g, ".").slice(0, 32)))].slice(0, 6);
}

/**
 * Chama API Sherlock self-hosted.
 * Contratos comuns:
 *   GET  {base}/api/v1/username/{user}
 *   POST {base}/api/sherlock  body { username }
 * Ajuste SHERLOCK_API_PATH se necessário.
 */
export async function sherlockLookupUsername(username: string): Promise<SherlockResult> {
  const base = String(process.env.SHERLOCK_API_URL || "").replace(/\/$/, "");
  if (!base || !sherlockConfigured()) {
    return {
      ok: false,
      username,
      hits: [],
      error: "Sherlock não configurado (SHERLOCK_ENABLED + SHERLOCK_API_URL)",
      fonte: "sherlock",
    };
  }
  const pathTpl = String(process.env.SHERLOCK_API_PATH || "/api/v1/username/{username}");
  const url = `${base}${pathTpl.replace("{username}", encodeURIComponent(username))}`;
  const timeoutMs = Math.min(
    Math.max(parseInt(process.env.SHERLOCK_TIMEOUT_MS || "20000", 10) || 20000, 5000),
    60000
  );
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: "GET",
      headers: { Accept: "application/json" },
      signal: controller.signal,
      cache: "no-store",
    });
    if (!res.ok) {
      // tenta POST alternativo
      const res2 = await fetch(`${base}/api/sherlock`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ username }),
        signal: controller.signal,
        cache: "no-store",
      }).catch(() => null);
      if (!res2 || !res2.ok) {
        return {
          ok: false,
          username,
          hits: [],
          error: `HTTP ${res.status}`,
          fonte: "sherlock",
        };
      }
      const data2 = await res2.json().catch(() => null);
      return normalizeSherlockPayload(username, data2);
    }
    const data = await res.json().catch(() => null);
    return normalizeSherlockPayload(username, data);
  } catch (e: any) {
    return {
      ok: false,
      username,
      hits: [],
      error: e?.name === "AbortError" ? "timeout" : e?.message || "falha",
      fonte: "sherlock",
    };
  } finally {
    clearTimeout(t);
  }
}

function normalizeSherlockPayload(username: string, data: any): SherlockResult {
  if (!data) return { ok: false, username, hits: [], error: "vazio", fonte: "sherlock" };
  const hits: SherlockHit[] = [];
  const arr =
    data.results ||
    data.sites ||
    data.found ||
    data.data ||
    (Array.isArray(data) ? data : null);
  if (Array.isArray(arr)) {
    for (const row of arr) {
      const site = String(row.site || row.name || row.platform || "").trim();
      const url = String(row.url || row.link || row.profile || "").trim();
      if (url.startsWith("http")) hits.push({ site: site || new URL(url).hostname, url });
    }
  } else if (data && typeof data === "object") {
    for (const [k, v] of Object.entries(data)) {
      if (typeof v === "string" && v.startsWith("http")) hits.push({ site: k, url: v });
      if (v && typeof v === "object" && String((v as any).url || "").startsWith("http")) {
        hits.push({ site: k, url: String((v as any).url) });
      }
    }
  }
  return { ok: hits.length > 0, username, hits, fonte: "sherlock-selfhost" };
}

export async function sherlockLookupNome(nome: string): Promise<{
  ok: boolean;
  tried: string[];
  hits: Array<SherlockHit & { username: string }>;
  error?: string;
}> {
  const users = usernamesFromNome(nome);
  if (!users.length) return { ok: false, tried: [], hits: [], error: "nome inválido" };
  if (!sherlockConfigured()) {
    return {
      ok: false,
      tried: users,
      hits: [],
      error: "Configure SHERLOCK_ENABLED=true e SHERLOCK_API_URL (API gratuita self-host).",
    };
  }
  const all: Array<SherlockHit & { username: string }> = [];
  for (const u of users.slice(0, 3)) {
    const r = await sherlockLookupUsername(u);
    for (const h of r.hits) all.push({ ...h, username: u });
    await new Promise((r) => setTimeout(r, 300));
  }
  return { ok: all.length > 0, tried: users, hits: all };
}

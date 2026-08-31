/**
 * Cache de preview de abas (hover no dock).
 * Guarda título + trecho de texto + miniatura opcional (canvas) por rota.
 */

export type RouteSnapshot = {
  href: string;
  title: string;
  excerpt: string;
  capturedAt: number;
  thumbDataUrl?: string | null;
};

const DB_KEY = "lexis_route_snapshots_v1";
const MAX_ENTRIES = 40;

function readAll(): Record<string, RouteSnapshot> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(DB_KEY);
    if (!raw) return {};
    return JSON.parse(raw) || {};
  } catch {
    return {};
  }
}

function writeAll(map: Record<string, RouteSnapshot>) {
  try {
    const entries = Object.entries(map).sort((a, b) => b[1].capturedAt - a[1].capturedAt);
    const trimmed = Object.fromEntries(entries.slice(0, MAX_ENTRIES));
    localStorage.setItem(DB_KEY, JSON.stringify(trimmed));
  } catch {
    /* quota */
  }
}

export function getRouteSnapshot(href: string): RouteSnapshot | null {
  const map = readAll();
  const key = normalizeHref(href);
  return map[key] || null;
}

export function normalizeHref(href: string) {
  try {
    const u = href.startsWith("http") ? new URL(href) : new URL(href, "http://local");
    return (u.pathname || "/").replace(/\/$/, "") || "/";
  } catch {
    return href || "/";
  }
}

export function saveRouteSnapshot(partial: Omit<RouteSnapshot, "capturedAt"> & { capturedAt?: number }) {
  const key = normalizeHref(partial.href);
  const map = readAll();
  map[key] = {
    href: key,
    title: partial.title.slice(0, 120),
    excerpt: partial.excerpt.slice(0, 280),
    capturedAt: partial.capturedAt || Date.now(),
    thumbDataUrl: partial.thumbDataUrl || map[key]?.thumbDataUrl || null,
  };
  writeAll(map);
  try {
    window.dispatchEvent(new CustomEvent("lexis-route-snapshot", { detail: map[key] }));
  } catch {
    /* */
  }
}

/** Captura leve do main (texto + miniatura pequena). */
export async function captureCurrentRoute(pathname: string) {
  if (typeof window === "undefined" || typeof document === "undefined") return;
  const main =
    (document.querySelector("main") as HTMLElement | null) ||
    (document.querySelector("[data-lexis-main]") as HTMLElement | null) ||
    document.body;
  const title =
    document.title?.replace(/\s*[|·\-].*$/, "").trim() ||
    pathname;
  const text = (main?.innerText || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 280);

  let thumb: string | null = null;
  try {
    // miniatura via svg foreignObject (sem dependência extra)
    const w = 320;
    const h = 180;
    const cloneText = text.slice(0, 160).replace(/[<>&]/g, "");
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
      <rect width="100%" height="100%" fill="#0f172a"/>
      <rect x="8" y="8" width="${w - 16}" height="${h - 16}" rx="12" fill="#1e293b"/>
      <text x="20" y="40" fill="#34d399" font-size="14" font-family="system-ui" font-weight="700">${escapeXml(title.slice(0, 40))}</text>
      <text x="20" y="68" fill="#94a3b8" font-size="11" font-family="system-ui">${escapeXml(cloneText.slice(0, 50))}</text>
      <text x="20" y="86" fill="#64748b" font-size="10" font-family="system-ui">${escapeXml(cloneText.slice(50, 100))}</text>
      <text x="20" y="104" fill="#64748b" font-size="10" font-family="system-ui">${escapeXml(cloneText.slice(100, 150))}</text>
    </svg>`;
    thumb = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  } catch {
    thumb = null;
  }

  saveRouteSnapshot({
    href: pathname,
    title,
    excerpt: text || "Sem prévia ainda — abra a aba uma vez para cachear.",
    thumbDataUrl: thumb,
  });
}

function escapeXml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

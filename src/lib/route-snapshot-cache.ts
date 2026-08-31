/**
 * Preview realista das abas no dock — extrai texto/estrutura do main visitado.
 */

export type RouteSnapshot = {
  href: string;
  title: string;
  excerpt: string;
  lines: string[];
  chips: string[];
  capturedAt: number;
  thumbDataUrl?: string | null;
};

const DB_KEY = "lexis_route_snapshots_v2";
const MAX_ENTRIES = 48;

function readAll(): Record<string, RouteSnapshot> {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem(DB_KEY) || "{}") || {};
  } catch {
    return {};
  }
}

function writeAll(map: Record<string, RouteSnapshot>) {
  try {
    const entries = Object.entries(map).sort((a, b) => b[1].capturedAt - a[1].capturedAt);
    localStorage.setItem(DB_KEY, JSON.stringify(Object.fromEntries(entries.slice(0, MAX_ENTRIES))));
  } catch {
    /* */
  }
}

export function normalizeHref(href: string) {
  try {
    const u = href.startsWith("http") ? new URL(href) : new URL(href, "http://x");
    return (u.pathname || "/").replace(/\/$/, "") || "/";
  } catch {
    return href || "/";
  }
}

export function getRouteSnapshot(href: string): RouteSnapshot | null {
  return readAll()[normalizeHref(href)] || null;
}

export function saveRouteSnapshot(s: RouteSnapshot) {
  const key = normalizeHref(s.href);
  const map = readAll();
  map[key] = { ...s, href: key };
  writeAll(map);
  try {
    window.dispatchEvent(new CustomEvent("lexis-route-snapshot", { detail: map[key] }));
  } catch {
    /* */
  }
}

function pickText(el: Element | null, max = 80) {
  return (el?.textContent || "").replace(/\s+/g, " ").trim().slice(0, max);
}

/** Lê o main real: títulos, chips, linhas de lista/tabela. */
export async function captureCurrentRoute(pathname: string) {
  if (typeof document === "undefined") return;
  const main =
    (document.querySelector("main") as HTMLElement | null) ||
    (document.querySelector("[data-lexis-main]") as HTMLElement | null);
  if (!main) return;

  const h1 = main.querySelector("h1, h2, [data-page-title]");
  const title =
    pickText(h1, 100) ||
    document.title.replace(/\s*[|·\-].*$/, "").trim() ||
    pathname;

  const chips: string[] = [];
  main.querySelectorAll("button, [class*='badge'], [data-badge], .badge").forEach((el) => {
    const t = pickText(el, 28);
    if (t && t.length > 1 && t.length < 28 && chips.length < 6 && !chips.includes(t)) chips.push(t);
  });

  const lines: string[] = [];
  // linhas de tabela ou cards
  main.querySelectorAll("tbody tr, [data-case-card], .lexis-case-card").forEach((row) => {
    if (lines.length >= 5) return;
    const t = pickText(row, 90);
    if (t.length > 8) lines.push(t);
  });
  if (lines.length < 3) {
    main.querySelectorAll("p, li, .text-sm, .text-\\[13px\\]").forEach((el) => {
      if (lines.length >= 5) return;
      const t = pickText(el, 90);
      if (t.length > 20) lines.push(t);
    });
  }

  const excerpt = lines[0] || pickText(main, 200) || "Página em cache";

  // Miniatura HTML realista (glass), não fundo azul genérico
  const chipHtml = chips
    .slice(0, 4)
    .map(
      (c) =>
        `<span style="display:inline-block;margin:2px 4px 2px 0;padding:2px 8px;border-radius:999px;background:rgba(16,185,129,0.2);color:#6ee7b7;font-size:9px;font-weight:700">${escapeXml(c)}</span>`
    )
    .join("");
  const linesHtml = lines
    .slice(0, 4)
    .map(
      (l, i) =>
        `<div style="margin-top:6px;padding:6px 8px;border-radius:10px;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.08);font-size:10px;color:#cbd5e1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escapeXml(l)}</div>`
    )
    .join("");

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="200">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#0f172a"/>
      <stop offset="100%" stop-color="#1e293b"/>
    </linearGradient>
  </defs>
  <rect width="100%" height="100%" fill="url(#g)"/>
  <rect x="10" y="10" width="300" height="180" rx="16" fill="rgba(255,255,255,0.06)" stroke="rgba(255,255,255,0.12)"/>
  <text x="22" y="36" fill="#f8fafc" font-size="13" font-family="system-ui,sans-serif" font-weight="800">${escapeXml(title.slice(0, 36))}</text>
  <foreignObject x="18" y="44" width="284" height="28">
    <div xmlns="http://www.w3.org/1999/xhtml" style="font-family:system-ui,sans-serif">${chipHtml || '<span style="color:#64748b;font-size:10px">LexisPredict</span>'}</div>
  </foreignObject>
  <foreignObject x="18" y="74" width="284" height="110">
    <div xmlns="http://www.w3.org/1999/xhtml" style="font-family:system-ui,sans-serif">${linesHtml || '<div style="color:#64748b;font-size:11px;padding:8px">Sem linhas — role a página e volte</div>'}</div>
  </foreignObject>
</svg>`;

  saveRouteSnapshot({
    href: pathname,
    title,
    excerpt,
    lines,
    chips,
    capturedAt: Date.now(),
    thumbDataUrl: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`,
  });
}

function escapeXml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

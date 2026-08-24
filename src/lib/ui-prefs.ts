/**
 * Preferências de UI — Lote 1 (contraste + personalização segura).
 * localStorage por enquanto; estrutura pronta para persistir por usuário no Supabase.
 */
export type UiDensity = "compact" | "comfortable" | "wide";
export type UiFontScale = "90" | "100" | "110";

export type UiPrefs = {
  density: UiDensity;
  fontScale: UiFontScale;
  opsMode: boolean; // menos uppercase / menos “hype”
  sidebarHex: string;
  colorVencido: string;
  colorHoje: string;
  colorBa: string;
  wallpaperMinOpacity: number; // 0.85 default when wallpaper on
};

const KEY = "lexisPredict_ui_prefs_v1";

export const UI_PREFS_DEFAULT: UiPrefs = {
  density: "comfortable",
  fontScale: "100",
  opsMode: true,
  sidebarHex: "",
  colorVencido: "#b91c1c",
  colorHoje: "#1d4ed8",
  colorBa: "#dc2626",
  wallpaperMinOpacity: 0.85,
};

export function loadUiPrefs(): UiPrefs {
  if (typeof localStorage === "undefined") return { ...UI_PREFS_DEFAULT };
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...UI_PREFS_DEFAULT };
    return { ...UI_PREFS_DEFAULT, ...JSON.parse(raw) };
  } catch {
    return { ...UI_PREFS_DEFAULT };
  }
}

export function saveUiPrefs(partial: Partial<UiPrefs>): UiPrefs {
  const next = { ...loadUiPrefs(), ...partial };
  if (typeof localStorage !== "undefined") {
    localStorage.setItem(KEY, JSON.stringify(next));
  }
  applyUiPrefsToDom(next);
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("lexis-ui-prefs-changed"));
  }
  return next;
}

function hexToHslComponents(hex: string): string | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  let r = (n >> 16) / 255;
  let g = ((n >> 8) & 0xff) / 255;
  let b = (n & 0xff) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
        break;
      case g:
        h = ((b - r) / d + 2) / 6;
        break;
      default:
        h = ((r - g) / d + 4) / 6;
    }
  }
  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

export function applyUiPrefsToDom(prefs?: UiPrefs) {
  if (typeof document === "undefined") return;
  const p = prefs || loadUiPrefs();
  const root = document.documentElement;

  const dens =
    p.density === "compact" ? "0.85" : p.density === "wide" ? "1.15" : "1";
  root.style.setProperty("--ui-density", dens);
  root.style.setProperty(
    "--ui-font-scale",
    p.fontScale === "90" ? "0.9" : p.fontScale === "110" ? "1.1" : "1"
  );
  root.dataset.opsMode = p.opsMode ? "1" : "0";
  root.dataset.density = p.density;

  root.style.setProperty("--status-vencido", p.colorVencido);
  root.style.setProperty("--status-hoje", p.colorHoje);
  root.style.setProperty("--status-ba", p.colorBa);

  if (p.sidebarHex) {
    const hsl = hexToHslComponents(p.sidebarHex);
    if (hsl) {
      root.style.setProperty("--sidebar-background", hsl);
    }
  }

  root.style.setProperty(
    "--wallpaper-min-opacity",
    String(p.wallpaperMinOpacity)
  );
}

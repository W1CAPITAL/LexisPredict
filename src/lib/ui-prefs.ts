/**
 * Preferências UI — vidro DESLIGADO por padrão.
 * KEY v2 descarta estado legado com VIDRO ON que quebrava contraste.
 */
export type UiDensity = "compact" | "comfortable" | "wide";
export type UiFontScale = "90" | "100" | "110";

export type UiPrefs = {
  density: UiDensity;
  fontScale: UiFontScale;
  opsMode: boolean;
  sidebarHex: string;
  colorVencido: string;
  colorHoje: string;
  colorBa: string;
  wallpaperMinOpacity: number;
  glassSidebar: boolean;
  glassDialogs: boolean;
  glassCards: boolean;
  glassTabs: boolean;
};

const KEY = "lexisPredict_ui_prefs_v2";
const KEY_LEGACY = "lexisPredict_ui_prefs_v1";
const STYLE_ID = "lexis-ui-prefs-runtime";
const MIGRATED = "lexisPredict_ui_solid_migrated_v2";

export const UI_PREFS_DEFAULT: UiPrefs = {
  density: "comfortable",
  fontScale: "100",
  opsMode: true,
  sidebarHex: "",
  colorVencido: "#b91c1c",
  colorHoje: "#1d4ed8",
  colorBa: "#dc2626",
  wallpaperMinOpacity: 1,
  glassSidebar: false,
  glassDialogs: false,
  glassCards: false,
  glassTabs: false,
};

export function loadUiPrefs(): UiPrefs {
  if (typeof localStorage === "undefined") return { ...UI_PREFS_DEFAULT };
  try {
    // Uma vez: zera vidro legado
    if (!localStorage.getItem(MIGRATED)) {
      localStorage.removeItem(KEY_LEGACY);
      localStorage.setItem(KEY, JSON.stringify(UI_PREFS_DEFAULT));
      localStorage.setItem(MIGRATED, "1");
      localStorage.setItem("lexisPredict_bg_opacity", "1");
      localStorage.setItem("lexisPredict_sidebar_opacity", "1");
      localStorage.setItem("lexisPredict_glass_blur", "0");
    }
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

/** Reset total: sólido + limpa atmosfera legada */
export function resetUiSolid(): UiPrefs {
  if (typeof localStorage !== "undefined") {
    localStorage.setItem(KEY, JSON.stringify(UI_PREFS_DEFAULT));
    localStorage.setItem("lexisPredict_bg_opacity", "1");
    localStorage.setItem("lexisPredict_sidebar_opacity", "1");
    localStorage.setItem("lexisPredict_glass_blur", "0");
    localStorage.setItem(MIGRATED, "1");
  }
  applyUiPrefsToDom(UI_PREFS_DEFAULT);
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("lexis-ui-prefs-changed"));
    window.dispatchEvent(new Event("lexis-theme-changed"));
  }
  return { ...UI_PREFS_DEFAULT };
}

function hexToHslComponents(hex: string): string | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  const r = ((n >> 16) & 255) / 255;
  const g = ((n >> 8) & 255) / 255;
  const b = (n & 255) / 255;
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

  const dens = p.density === "compact" ? "0.9" : p.density === "wide" ? "1.12" : "1";
  const font = p.fontScale === "90" ? "0.9" : p.fontScale === "110" ? "1.1" : "1";
  root.style.setProperty("--ui-density", dens);
  root.style.setProperty("--ui-font-scale", font);
  root.dataset.opsMode = p.opsMode ? "1" : "0";
  root.dataset.density = p.density;
  root.dataset.glassSidebar = p.glassSidebar ? "1" : "0";
  root.dataset.glassDialogs = p.glassDialogs ? "1" : "0";
  root.dataset.glassCards = p.glassCards ? "1" : "0";
  root.dataset.glassTabs = p.glassTabs ? "1" : "0";
  root.style.setProperty("--status-vencido", p.colorVencido);
  root.style.setProperty("--status-hoje", p.colorHoje);
  root.style.setProperty("--status-ba", p.colorBa);
  if (p.sidebarHex) {
    const hsl = hexToHslComponents(p.sidebarHex);
    if (hsl) root.style.setProperty("--sidebar-background", hsl);
  }

  let el = document.getElementById(STYLE_ID) as HTMLStyleElement | null;
  if (!el) {
    el = document.createElement("style");
    el.id = STYLE_ID;
    document.head.appendChild(el);
  }

  const solidDlg = `
    background-color: #ffffff !important;
    background: hsl(var(--card, 0 0% 100%)) !important;
    opacity: 1 !important;
    backdrop-filter: none !important;
    -webkit-backdrop-filter: none !important;
  `;
  const glassDlg = `
    background-color: hsl(var(--card) / 0.92) !important;
    backdrop-filter: blur(12px) !important;
  `;

  el.textContent = `
    html { font-size: calc(16px * ${font}); }
    /* MODAIS — sólido por padrão (nunca ver fundo por trás) */
    [data-radix-dialog-content],
    [role="dialog"],
    [data-radix-alert-dialog-content],
    [data-state][role="dialog"] {
      ${p.glassDialogs ? glassDlg : solidDlg}
    }
    /* Overlay escuro legível */
    [data-radix-dialog-overlay], [data-radix-alert-dialog-overlay] {
      background-color: rgba(0,0,0,0.55) !important;
      backdrop-filter: none !important;
    }
    /* Cards */
    .bg-card, [data-admin-card], [data-efferd-kpi] {
      ${p.glassCards
        ? "background-color: hsl(var(--card) / 0.88) !important; backdrop-filter: blur(8px) !important;"
        : "background-color: hsl(var(--card)) !important; backdrop-filter: none !important; opacity: 1 !important;"}
    }
    /* Sidebar */
    aside.bg-sidebar, [data-sidebar] {
      ${p.glassSidebar
        ? "background-color: hsl(var(--sidebar-background) / 0.85) !important; backdrop-filter: blur(10px) !important;"
        : "background-color: hsl(var(--sidebar-background, 0 0% 98%)) !important; backdrop-filter: none !important; opacity: 1 !important;"}
    }
    html[data-glass-tabs="0"] header {
      background-color: hsl(var(--card)) !important;
      backdrop-filter: none !important;
    }
    /* Badges legíveis */
    .badge-baixa-tribunal, [data-badge="baixa"] {
      background: #18181b !important; color: #fff !important; border: none !important;
    }
  `;
}

/**
 * Hardware visual — wallpaper cobrindo app + sidebar, opacidade real, cards legíveis.
 */
import { browserStorage } from "@/lib/browser-storage";

function clamp01(n: number, fallback = 1): number {
  if (!Number.isFinite(n)) return fallback;
  return Math.min(1, Math.max(0.2, n));
}

export function setCssOpacityVars(
  bgOpacity01: number,
  sidebarOpacity01: number,
  blurPx: number
) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  const bg = clamp01(bgOpacity01, 1);
  const side = clamp01(sidebarOpacity01, 1);
  const blur = Math.max(0, Math.min(24, Number.isFinite(blurPx) ? blurPx : 0));
  root.style.setProperty("--bg-opacity", String(bg));
  root.style.setProperty("--sidebar-opacity", String(side));
  root.style.setProperty("--glass-blur", `${blur}px`);
  root.style.setProperty("--card-opacity", "0.94");
}

export function persistOpacity(
  bgOpacity01: number,
  sidebarOpacity01: number,
  blurPx: number
) {
  if (typeof localStorage === "undefined") return;
  const bg = clamp01(bgOpacity01, 1);
  const side = clamp01(sidebarOpacity01, 1);
  const blur = Math.max(0, Math.min(24, Number.isFinite(blurPx) ? blurPx : 0));
  localStorage.setItem("lexisPredict_bg_opacity", String(bg));
  localStorage.setItem("lexisPredict_sidebar_opacity", String(side));
  localStorage.setItem("lexisPredict_glass_blur", String(blur));
  setCssOpacityVars(bg, side, blur);
  ensureWallpaperCss();
  window.dispatchEvent(new Event("lexis-theme-changed"));
}

/** Sólido sem wallpaper — contraste máximo. */
export function forceSolidAtmosphere() {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem("lexisPredict_bg_opacity", "1");
  localStorage.setItem("lexisPredict_sidebar_opacity", "1");
  localStorage.setItem("lexisPredict_glass_blur", "0");
  setCssOpacityVars(1, 1, 0);
  if (typeof document !== "undefined") {
    if (document.body) {
      document.body.style.backgroundColor = "";
      document.body.style.opacity = "1";
    }
  }
  ensureWallpaperCss();
  window.dispatchEvent(new Event("lexis-theme-changed"));
}

function ensureLayer(): HTMLElement | null {
  if (typeof document === "undefined") return null;
  let layer = document.getElementById("lexis-wallpaper-layer");
  if (!layer) {
    layer = document.createElement("div");
    layer.id = "lexis-wallpaper-layer";
    layer.setAttribute(
      "style",
      [
        "position:fixed",
        "inset:0",
        "z-index:0",
        "pointer-events:none",
        "background-size:cover",
        "background-position:center",
        "background-repeat:no-repeat",
      ].join(";")
    );
    document.body.prepend(layer);
  }
  return layer;
}

export function ensureWallpaperCss() {
  if (typeof document === "undefined") return;
  const STYLE_ID = "lexis-wallpaper-runtime-css";
  let el = document.getElementById(STYLE_ID) as HTMLStyleElement | null;
  if (!el) {
    el = document.createElement("style");
    el.id = STYLE_ID;
    document.head.appendChild(el);
  }
  el.textContent = `
    #lexis-wallpaper-layer {
      position: fixed !important;
      inset: 0 !important;
      z-index: 0 !important;
      pointer-events: none !important;
      background-size: cover !important;
      background-position: center !important;
      background-repeat: no-repeat !important;
    }
    html.lexis-wallpaper-active body {
      background-color: transparent !important;
    }
    html.lexis-wallpaper-active .bg-background,
    html.lexis-wallpaper-active main,
    html.lexis-wallpaper-active [data-main-shell] {
      background-color: hsl(var(--background) / var(--bg-opacity, 0.85)) !important;
    }
    html.lexis-wallpaper-active aside,
    html.lexis-wallpaper-active [data-sidebar],
    html.lexis-wallpaper-active .bg-sidebar {
      background-color: hsl(var(--sidebar-background, 0 0% 100%) / var(--sidebar-opacity, 0.88)) !important;
      backdrop-filter: blur(var(--glass-blur, 0px)) !important;
      -webkit-backdrop-filter: blur(var(--glass-blur, 0px)) !important;
    }
    html.lexis-wallpaper-active .bg-card,
    html.lexis-wallpaper-active [data-admin-card],
    html.lexis-wallpaper-active [data-efferd-kpi],
    html.lexis-wallpaper-active [data-slot="card"] {
      background-color: hsl(var(--card) / var(--card-opacity, 0.94)) !important;
      backdrop-filter: blur(calc(var(--glass-blur, 0px) + 6px)) !important;
      -webkit-backdrop-filter: blur(calc(var(--glass-blur, 0px) + 6px)) !important;
      color: hsl(var(--card-foreground, 222 47% 11%)) !important;
      opacity: 1 !important;
    }
    .relative.z-10 { position: relative; z-index: 10; }
  `;
}

export function applyWallpaperUrl(url: string) {
  if (typeof localStorage === "undefined" || typeof document === "undefined") return;
  if (!url) {
    void resetWallpaper();
    return;
  }
  localStorage.setItem("lexisPredict_wallpaper", url);
  const root = document.documentElement;
  root.classList.add("lexis-wallpaper-active");
  const layer = ensureLayer();
  if (layer) {
    layer.style.backgroundImage = url.startsWith("url(") ? url : `url(${url})`;
  }
  // Com wallpaper: opacidade padrão legível (ainda mostra a imagem)
  const bg = parseFloat(localStorage.getItem("lexisPredict_bg_opacity") || "0.82");
  const side = parseFloat(localStorage.getItem("lexisPredict_sidebar_opacity") || "0.86");
  const blur = parseFloat(localStorage.getItem("lexisPredict_glass_blur") || "8");
  const bgN = bg >= 0.99 ? 0.82 : clamp01(bg);
  const sideN = side >= 0.99 ? 0.86 : clamp01(side);
  const blurN = blur <= 0 ? 8 : blur;
  localStorage.setItem("lexisPredict_bg_opacity", String(bgN));
  localStorage.setItem("lexisPredict_sidebar_opacity", String(sideN));
  localStorage.setItem("lexisPredict_glass_blur", String(blurN));
  setCssOpacityVars(bgN, sideN, blurN);
  ensureWallpaperCss();
  window.dispatchEvent(new Event("lexis-wallpaper-changed"));
  window.dispatchEvent(new Event("lexis-theme-changed"));
}

export function applyWallpaperStyle(imageValue: string) {
  if (!imageValue) {
    void resetWallpaper();
    return;
  }
  applyWallpaperUrl(imageValue);
}

export async function resetWallpaper() {
  if (typeof localStorage === "undefined" || typeof document === "undefined") return;
  localStorage.removeItem("lexisPredict_wallpaper");
  const root = document.documentElement;
  root.classList.remove("lexis-wallpaper-active");
  root.style.backgroundImage = "none";
  const layer = document.getElementById("lexis-wallpaper-layer");
  if (layer) layer.remove();
  try {
    await browserStorage.removeAsset("main_wallpaper_blob");
  } catch {
    /* */
  }
  forceSolidAtmosphere();
  ensureWallpaperCss();
  window.dispatchEvent(new Event("lexis-wallpaper-changed"));
}

export async function saveWallpaperFile(file: File): Promise<string> {
  await browserStorage.saveAsset("main_wallpaper_blob", file);
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result || "");
      try {
        localStorage.setItem("lexisPredict_wallpaper", dataUrl);
      } catch {
        localStorage.removeItem("lexisPredict_wallpaper");
      }
      applyWallpaperUrl(dataUrl);
      resolve(dataUrl);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function loadVisualStateFromStorage() {
  if (typeof localStorage === "undefined") {
    return { bgOpacity01: 1, sidebarOpacity01: 1, glassBlur: 0, wallpaper: "" };
  }
  let bg = parseFloat(localStorage.getItem("lexisPredict_bg_opacity") || "1");
  let side = parseFloat(localStorage.getItem("lexisPredict_sidebar_opacity") || "1");
  let blur = parseFloat(localStorage.getItem("lexisPredict_glass_blur") || "0");
  if (!Number.isFinite(bg)) bg = 1;
  if (!Number.isFinite(side)) side = 1;
  if (!Number.isFinite(blur)) blur = 0;
  bg = clamp01(bg, 1);
  side = clamp01(side, 1);
  blur = Math.max(0, Math.min(24, blur));
  const wallpaper = localStorage.getItem("lexisPredict_wallpaper") || "";
  return {
    bgOpacity01: bg,
    sidebarOpacity01: side,
    glassBlur: blur,
    wallpaper,
  };
}

/** Reset visual completo → Minimal Steel light, sem wallpaper. */
export function resetVisualToFactory() {
  if (typeof localStorage === "undefined") return;
  const keys = [
    "lexis_theme_mode",
    "lexis_dark_mode",
    "theme",
    "lexisPredict_theme_preset",
    "lexisPredict_custom_theme",
    "lexisPredict_bg_color",
    "lexisPredict_bg_secondary_color",
    "lexisPredict_font_color",
    "lexisPredict_font_muted_color",
    "lexisPredict_btn_bg_color",
    "lexisPredict_wallpaper",
    "lexisPredict_bg_opacity",
    "lexisPredict_sidebar_opacity",
    "lexisPredict_glass_blur",
    "lexisPredict_ui_prefs_v1",
    "lexisPredict_ui_prefs_v2",
  ];
  keys.forEach((k) => localStorage.removeItem(k));
  localStorage.setItem("lexis_theme_mode", "light");
  localStorage.setItem("lexis_dark_mode", "false");
  localStorage.setItem("lexisPredict_theme_preset", "minimal-steel");
  localStorage.setItem("lexisPredict_bg_opacity", "1");
  localStorage.setItem("lexisPredict_sidebar_opacity", "1");
  localStorage.setItem("lexisPredict_glass_blur", "0");
  void resetWallpaper();
  forceSolidAtmosphere();
  if (typeof document !== "undefined") {
    document.documentElement.classList.remove("dark", "lexis-wallpaper-active");
    document.documentElement.classList.add("light");
  }
  window.dispatchEvent(new Event("lexis-theme-changed"));
  window.dispatchEvent(new Event("lexis-ui-prefs-changed"));
}

/**
 * Hardware visual — padrão SÓLIDO (opacidade 100%, blur 0).
 * Wallpaper só afeta camada isolada; não deixa body transparente.
 */
import { browserStorage } from "@/lib/browser-storage";

export function setCssOpacityVars(
  bgOpacity01: number,
  sidebarOpacity01: number,
  blurPx: number
) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  // Nunca aplicar opacidade ilegível
  const bg = bgOpacity01 < 0.92 ? 1 : bgOpacity01;
  const side = sidebarOpacity01 < 0.92 ? 1 : sidebarOpacity01;
  const blur = Math.min(blurPx, bg < 1 ? blurPx : 0);
  root.style.setProperty("--bg-opacity", String(bg));
  root.style.setProperty("--sidebar-opacity", String(side));
  root.style.setProperty("--glass-blur", `${blur}px`);
  root.style.setProperty("--card-opacity", "1");
}

export function persistOpacity(
  bgOpacity01: number,
  sidebarOpacity01: number,
  blurPx: number
) {
  if (typeof localStorage === "undefined") return;
  const bg = bgOpacity01 < 0.92 ? 1 : bgOpacity01;
  const side = sidebarOpacity01 < 0.92 ? 1 : sidebarOpacity01;
  const blur = bg >= 0.99 ? 0 : blurPx;
  localStorage.setItem("lexisPredict_bg_opacity", String(bg));
  localStorage.setItem("lexisPredict_sidebar_opacity", String(side));
  localStorage.setItem("lexisPredict_glass_blur", String(blur));
  setCssOpacityVars(bg, side, blur);
  window.dispatchEvent(new Event("lexis-theme-changed"));
}

/** Força contraste sólido (chamar no boot e no botão Configurações). */
export function forceSolidAtmosphere() {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem("lexisPredict_bg_opacity", "1");
  localStorage.setItem("lexisPredict_sidebar_opacity", "1");
  localStorage.setItem("lexisPredict_glass_blur", "0");
  setCssOpacityVars(1, 1, 0);
  if (typeof document !== "undefined") {
    const root = document.documentElement;
    if (document.body) {
      document.body.style.backgroundColor = "";
      document.body.style.opacity = "1";
    }
    root.style.setProperty("--bg-opacity", "1");
    root.style.setProperty("--sidebar-opacity", "1");
    root.style.setProperty("--glass-blur", "0px");
  }
  window.dispatchEvent(new Event("lexis-theme-changed"));
}

export function applyWallpaperUrl(url: string) {
  if (typeof localStorage === "undefined" || typeof document === "undefined") return;
  localStorage.setItem("lexisPredict_wallpaper", url);
  const root = document.documentElement;
  root.classList.add("lexis-wallpaper-active");
  // Camada dedicada — NÃO transparentar body
  let layer = document.getElementById("lexis-wallpaper-layer");
  if (!layer) {
    layer = document.createElement("div");
    layer.id = "lexis-wallpaper-layer";
    layer.setAttribute(
      "style",
      "position:fixed;inset:0;z-index:-1;pointer-events:none;background-size:cover;background-position:center;background-repeat:no-repeat;"
    );
    document.body.prepend(layer);
  }
  layer.style.backgroundImage = `url(${url})`;
  if (document.body) document.body.style.backgroundColor = "";
  // Mantém UI sólida
  forceSolidAtmosphere();
  window.dispatchEvent(new Event("lexis-wallpaper-changed"));
}

export function applyWallpaperStyle(imageValue: string) {
  if (typeof localStorage === "undefined" || typeof document === "undefined") return;
  if (!imageValue) {
    resetWallpaper();
    return;
  }
  localStorage.setItem("lexisPredict_wallpaper", imageValue);
  const root = document.documentElement;
  root.classList.add("lexis-wallpaper-active");
  let layer = document.getElementById("lexis-wallpaper-layer");
  if (!layer) {
    layer = document.createElement("div");
    layer.id = "lexis-wallpaper-layer";
    layer.setAttribute(
      "style",
      "position:fixed;inset:0;z-index:-1;pointer-events:none;background-size:cover;background-position:center;background-repeat:no-repeat;"
    );
    document.body.prepend(layer);
  }
  layer.style.backgroundImage = imageValue;
  if (document.body) document.body.style.backgroundColor = "";
  forceSolidAtmosphere();
  window.dispatchEvent(new Event("lexis-wallpaper-changed"));
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
  // Migração: valores antigos ilegíveis → sólido
  if (!Number.isFinite(bg) || bg < 0.92) bg = 1;
  if (!Number.isFinite(side) || side < 0.92) side = 1;
  if (!Number.isFinite(blur) || bg >= 0.99) blur = 0;
  const wallpaper = localStorage.getItem("lexisPredict_wallpaper") || "";
  return {
    bgOpacity01: bg,
    sidebarOpacity01: side,
    glassBlur: blur,
    wallpaper,
  };
}

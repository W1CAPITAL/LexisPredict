
import { browserStorage } from "@/lib/browser-storage";

/**
 * MOTOR DE HARDWARE VISUAL v200.0 ELITE
 * Gerencia opacidade, blur, wallpapers e injeção de variáveis de estilo no root.
 * Proprietário: W1 Capital | Fundador: Davi Alves Figueredo
 */

export function setCssOpacityVars(
  bgOpacity01: number,
  sidebarOpacity01: number,
  blurPx: number
) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.style.setProperty("--bg-opacity", String(bgOpacity01));
  root.style.setProperty("--sidebar-opacity", String(sidebarOpacity01));
  root.style.setProperty("--glass-blur", `${blurPx}px`);
}

export function persistOpacity(
  bgOpacity01: number,
  sidebarOpacity01: number,
  blurPx: number
) {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem("lexisPredict_bg_opacity", String(bgOpacity01));
  localStorage.setItem("lexisPredict_sidebar_opacity", String(sidebarOpacity01));
  localStorage.setItem("lexisPredict_glass_blur", String(blurPx));
  setCssOpacityVars(bgOpacity01, sidebarOpacity01, blurPx);
  
  // Notificar outros componentes da mudança de tema/atmosfera
  window.dispatchEvent(new Event("lexis-theme-changed"));
}

export function applyWallpaperUrl(url: string) {
  if (typeof localStorage === 'undefined' || typeof document === 'undefined') return;
  
  localStorage.setItem("lexisPredict_wallpaper", url);
  const root = document.documentElement;
  
  root.style.backgroundImage = `url(${url})`;
  root.style.backgroundSize = 'cover';
  root.style.backgroundPosition = 'center';
  root.style.backgroundAttachment = 'fixed';
  root.style.backgroundRepeat = 'no-repeat';
  
  window.dispatchEvent(new Event("lexis-wallpaper-changed"));
}

export async function resetWallpaper() {
  if (typeof localStorage === 'undefined' || typeof document === 'undefined') return;
  
  localStorage.removeItem("lexisPredict_wallpaper");
  document.documentElement.style.backgroundImage = 'none';
  
  try {
    await browserStorage.removeAsset("main_wallpaper_blob");
  } catch (e) {}
  
  window.dispatchEvent(new Event("lexis-wallpaper-changed"));
}

export async function saveWallpaperFile(file: File): Promise<string> {
  // Salvar no IndexedDB para persistência de grandes volumes
  await browserStorage.saveAsset("main_wallpaper_blob", file);
  
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result || "");
      try {
        localStorage.setItem("lexisPredict_wallpaper", dataUrl);
      } catch {
        // Se exceder a quota do LS, ainda temos no IndexedDB, mas limpamos o LS para evitar erros
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
  if (typeof localStorage === 'undefined') {
    return { bgOpacity01: 0.85, sidebarOpacity01: 0.9, glassBlur: 8, wallpaper: "" };
  }
  
  const bg = parseFloat(localStorage.getItem("lexisPredict_bg_opacity") || "0.85");
  const side = parseFloat(localStorage.getItem("lexisPredict_sidebar_opacity") || "0.9");
  const blur = parseFloat(localStorage.getItem("lexisPredict_glass_blur") || "8");
  const wallpaper = localStorage.getItem("lexisPredict_wallpaper") || "";

  return {
    bgOpacity01: Number.isFinite(bg) ? bg : 0.85,
    sidebarOpacity01: Number.isFinite(side) ? side : 0.9,
    glassBlur: Number.isFinite(blur) ? blur : 8,
    wallpaper,
  };
}

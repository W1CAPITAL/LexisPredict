/**
 * Preferências de botões metálicos — opcionais e com cores customizáveis.
 *
 * Persistência: localStorage (chaves lexisPredict_metal_*).
 * Aplicação: CSS variables --metal-chromatic / --metal-silver / --metal-gold
 * (mesmas usadas por metal-tokens.css), então nenhum componente precisa de
 * WebGL — a cor escolhida aparece em todos os botões metálicos.
 */
import * as React from "react";

export type MetalPresetKey = "chromatic" | "silver" | "gold";

export const METAL_ENABLED_KEY = "lexisPredict_metal_enabled";
export const METAL_COLOR_KEYS: Record<MetalPresetKey, string> = {
  chromatic: "lexisPredict_metal_color_chromatic",
  silver: "lexisPredict_metal_color_silver",
  gold: "lexisPredict_metal_color_gold",
};
export const METAL_CHANGED_EVENT = "lexis-metal-changed";

export type MetalPreferences = {
  enabled: boolean;
  colors: Record<MetalPresetKey, string>;
};

export const DEFAULT_METAL_COLORS: Record<MetalPresetKey, string> = {
  chromatic: "#6366f1",
  silver: "#94a3b8",
  gold: "#f59e0b",
};

function shade(hex: string, amount: number): string {
  const h = String(hex || "").replace("#", "").trim();
  if (!/^[0-9a-f]{3}$/i.test(h) && !/^[0-9a-f]{6}$/i.test(h)) return hex;
  const full =
    h.length === 3
      ? h
          .split("")
          .map((c) => c + c)
          .join("")
      : h;
  const num = parseInt(full, 16);
  if (Number.isNaN(num)) return hex;
  const clamp = (v: number) => Math.min(255, Math.max(0, v));
  const r = clamp((num >> 16) + Math.round(255 * amount));
  const g = clamp(((num >> 8) & 0xff) + Math.round(255 * amount));
  const b = clamp((num & 0xff) + Math.round(255 * amount));
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
}

export function getMetalPreferences(): MetalPreferences {
  if (typeof localStorage === "undefined") {
    return { enabled: true, colors: { ...DEFAULT_METAL_COLORS } };
  }
  const enabled = localStorage.getItem(METAL_ENABLED_KEY) !== "false";
  const colors: Record<MetalPresetKey, string> = { ...DEFAULT_METAL_COLORS };
  (Object.keys(METAL_COLOR_KEYS) as MetalPresetKey[]).forEach((k) => {
    const saved = localStorage.getItem(METAL_COLOR_KEYS[k]);
    if (saved && /^#[0-9a-fA-F]{6}$/.test(saved)) colors[k] = saved.toLowerCase();
  });
  return { enabled, colors };
}

/** Aplica cores/estado ao vivo (CSS vars) e persiste. */
export function applyMetalPreferences(prefs: MetalPreferences) {
  if (typeof window === "undefined" || typeof document === "undefined") return;
  const root = document.documentElement;
  root.style.setProperty(
    "--metal-chromatic",
    `linear-gradient(135deg, ${shade(prefs.colors.chromatic, 0.22)} 0%, ${prefs.colors.chromatic} 50%, ${shade(prefs.colors.chromatic, -0.35)} 100%)`
  );
  root.style.setProperty(
    "--metal-silver",
    `linear-gradient(135deg, #e2e8f0 0%, ${prefs.colors.silver} 45%, ${shade(prefs.colors.silver, -0.5)} 100%)`
  );
  root.style.setProperty(
    "--metal-gold",
    `linear-gradient(135deg, #fde68a 0%, ${prefs.colors.gold} 50%, ${shade(prefs.colors.gold, -0.4)} 100%)`
  );
  try {
    localStorage.setItem(METAL_ENABLED_KEY, prefs.enabled ? "true" : "false");
    (Object.keys(METAL_COLOR_KEYS) as MetalPresetKey[]).forEach((k) => {
      localStorage.setItem(METAL_COLOR_KEYS[k], prefs.colors[k]);
    });
  } catch { /* storage indisponível */ }
  window.dispatchEvent(new CustomEvent(METAL_CHANGED_EVENT));
}

/** Hook reativo: usado pelos componentes para saber se o metal está ligado. */
export function useMetalPreferences(): MetalPreferences {
  const [prefs, setPrefs] = React.useState<MetalPreferences>(() =>
    getMetalPreferences()
  );
  React.useEffect(() => {
    const onChanged = () => setPrefs(getMetalPreferences());
    window.addEventListener(METAL_CHANGED_EVENT, onChanged);
    window.addEventListener("storage", onChanged);
    return () => {
      window.removeEventListener(METAL_CHANGED_EVENT, onChanged);
      window.removeEventListener("storage", onChanged);
    };
  }, []);
  return prefs;
}

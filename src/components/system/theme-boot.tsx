"use client";

/**
 * Boot: Minimal Steel (claro) + sólido (sem vidro/wallpaper) se não houver preset salvo.
 * Não força light se o usuário já escolheu dark — mas remove transparência legada.
 */
import { useEffect } from "react";
import { applyPresetById, getSavedPresetId, applyStoredCustom, applyGlobalTheme, getPresetColors, AUTHORITY_PRESETS } from "@/lib/theme";
import { loadUiPrefs, applyUiPrefsToDom, UI_PREFS_DEFAULT, saveUiPrefs } from "@/lib/ui-prefs";

export function ThemeBoot() {
  useEffect(() => {
    try {
      const saved = getSavedPresetId();
      if (!saved) {
        // Padrão de fábrica: Minimal Steel light
        applyPresetById("minimal-steel", "light");
        document.documentElement.classList.remove("dark");
        localStorage.setItem("lexisPredict_theme_preset", "minimal-steel");
        localStorage.setItem("theme", "light");
      } else if (saved === "custom-hardware") {
        applyStoredCustom();
      } else {
        applyPresetById(saved);
      }

      // Solid defaults — nunca vidro no boot
      const prefs = loadUiPrefs();
      const solid = {
        ...prefs,
        glassSidebar: false,
        glassDialogs: false,
        glassCards: false,
        glassTabs: false,
      };
      // Se prefs legadas tinham opacidade baixa, normaliza
      saveUiPrefs(solid);
      applyUiPrefsToDom(solid);

      // Garante opacidades sólidas
      localStorage.setItem("lexisPredict_bg_opacity", "1");
      localStorage.setItem("lexisPredict_sidebar_opacity", "1");
      localStorage.setItem("lexisPredict_glass_blur", "0");
      document.documentElement.style.setProperty("--bg-opacity", "1");
      document.documentElement.style.setProperty("--sidebar-opacity", "1");
    } catch (e) {
      console.warn("[ThemeBoot]", e);
    }
  }, []);
  return null;
}

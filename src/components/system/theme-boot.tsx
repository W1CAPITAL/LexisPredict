"use client";

import { useEffect } from "react";
import { applySavedPreset, getSavedPresetId } from "@/lib/theme";
import { loadUiPrefs, applyUiPrefsToDom, saveUiPrefs, UI_PREFS_DEFAULT } from "@/lib/ui-prefs";

/**
 * Aplica o tema salvo; nunca força claro, apaga a escolha ou impõe branco
 * sobre palettes SheetsPredict escuras. A paleta inicial já vem do layout.
 */
export function ThemeBoot() {
  useEffect(() => {
    try {
      const root = document.documentElement;
      const savedMode = localStorage.getItem("lexis_theme_mode") || "light";
      const dark = savedMode === "dark" ||
        (savedMode === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
      root.classList.toggle("dark", dark);
      root.classList.toggle("light", !dark);
      localStorage.setItem("lexis_dark_mode", String(dark));

      if (!getSavedPresetId()) {
        localStorage.setItem("lexisPredict_theme_preset", "minimal-steel");
      }
      applySavedPreset(dark ? "dark" : "light");

      const solid = {
        ...UI_PREFS_DEFAULT,
        ...loadUiPrefs(),
        glassSidebar: false,
        glassDialogs: false,
        glassCards: false,
        glassTabs: false,
      };
      saveUiPrefs(solid);
      applyUiPrefsToDom(solid);

      const legacyForce = document.getElementById("lexis-force-contrast");
      if (legacyForce) legacyForce.remove();
    } catch (error) {
      console.warn("[ThemeBoot]", error);
    }
  }, []);
  return null;
}

"use client";

import { useEffect } from "react";
import { applyUiPrefsToDom, loadUiPrefs } from "@/lib/ui-prefs";
import { loadVisualStateFromStorage, persistOpacity, setCssOpacityVars } from "@/lib/visual-hardware";

/** Aplica densidade/cores e garante contraste sólido no boot. */
export function UiPrefsApplier() {
  useEffect(() => {
    applyUiPrefsToDom(loadUiPrefs());
    try {
      const v = loadVisualStateFromStorage();
      // nunca iniciar com vidro invisível
      const bg = v.bgOpacity01 < 0.85 ? 1 : v.bgOpacity01;
      const side = v.sidebarOpacity01 < 0.85 ? 1 : v.sidebarOpacity01;
      const blur = v.glassBlur > 12 ? 0 : v.glassBlur;
      setCssOpacityVars(bg, side, blur);
      if (bg !== v.bgOpacity01 || side !== v.sidebarOpacity01) {
        persistOpacity(bg, side, blur);
      }
      document.body.style.backgroundColor = "hsl(var(--background))";
      document.documentElement.style.backgroundImage = "none";
    } catch {}
    const on = () => applyUiPrefsToDom(loadUiPrefs());
    window.addEventListener("lexis-ui-prefs-changed", on);
    window.addEventListener("storage", on);
    return () => {
      window.removeEventListener("lexis-ui-prefs-changed", on);
      window.removeEventListener("storage", on);
    };
  }, []);
  return null;
}

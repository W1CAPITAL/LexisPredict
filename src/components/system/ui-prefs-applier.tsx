"use client";

import { useEffect } from "react";
import { applyUiPrefsToDom, loadUiPrefs } from "@/lib/ui-prefs";
import { forceSolidAtmosphere, loadVisualStateFromStorage, setCssOpacityVars } from "@/lib/visual-hardware";

export function UiPrefsApplier() {
  useEffect(() => {
    // Atmosfera: nunca opacidade baixa
    const v = loadVisualStateFromStorage();
    setCssOpacityVars(v.bgOpacity01, v.sidebarOpacity01, v.glassBlur);
    if (v.bgOpacity01 < 0.95 || v.glassBlur > 0) {
      forceSolidAtmosphere();
    }
    applyUiPrefsToDom(loadUiPrefs());

    const on = () => {
      applyUiPrefsToDom(loadUiPrefs());
    };
    window.addEventListener("lexis-ui-prefs-changed", on);
    window.addEventListener("storage", on);
    window.addEventListener("lexis-theme-changed", on);
    return () => {
      window.removeEventListener("lexis-ui-prefs-changed", on);
      window.removeEventListener("storage", on);
      window.removeEventListener("lexis-theme-changed", on);
    };
  }, []);
  return null;
}

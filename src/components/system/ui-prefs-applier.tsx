"use client";

import { useEffect } from "react";
import { applyUiPrefsToDom, loadUiPrefs } from "@/lib/ui-prefs";
import {
  ensureWallpaperCss,
  loadVisualStateFromStorage,
  setCssOpacityVars,
  applyWallpaperUrl,
} from "@/lib/visual-hardware";

export function UiPrefsApplier() {
  useEffect(() => {
    const v = loadVisualStateFromStorage();
    setCssOpacityVars(v.bgOpacity01, v.sidebarOpacity01, v.glassBlur);
    ensureWallpaperCss();
    if (v.wallpaper) {
      applyWallpaperUrl(v.wallpaper);
    }
    applyUiPrefsToDom(loadUiPrefs());

    const on = () => {
      applyUiPrefsToDom(loadUiPrefs());
      ensureWallpaperCss();
    };
    window.addEventListener("lexis-ui-prefs-changed", on);
    window.addEventListener("storage", on);
    window.addEventListener("lexis-theme-changed", on);
    window.addEventListener("lexis-wallpaper-changed", on);
    return () => {
      window.removeEventListener("lexis-ui-prefs-changed", on);
      window.removeEventListener("storage", on);
      window.removeEventListener("lexis-theme-changed", on);
      window.removeEventListener("lexis-wallpaper-changed", on);
    };
  }, []);
  return null;
}

"use client";

import { useEffect } from "react";
import { applyUiPrefsToDom, loadUiPrefs } from "@/lib/ui-prefs";

/** Aplica densidade, fonte, cores de status e sidebar no boot. */
export function UiPrefsApplier() {
  useEffect(() => {
    applyUiPrefsToDom(loadUiPrefs());
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

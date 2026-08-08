"use client";

import { useEffect } from "react";
import {
  applyMetalPreferences,
  getMetalPreferences,
} from "@/lib/metal-preferences";

/**
 * Aplica no boot as preferências metálicas salvas (cores/toggle)
 * via CSS variables — componente invisível, renderizado no layout.
 */
export function MetalPrefsApplier() {
  useEffect(() => {
    try {
      applyMetalPreferences(getMetalPreferences());
    } catch {
      /* localStorage indisponível */
    }
  }, []);
  return null;
}

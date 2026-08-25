"use client";

/**
 * Boot: Minimal Steel CLARO + sólido. Repara contraste ilegível (letra clara em fundo claro).
 */
import { useEffect } from "react";
import { applyPresetById, getSavedPresetId, applyStoredCustom } from "@/lib/theme";
import { loadUiPrefs, applyUiPrefsToDom, saveUiPrefs, UI_PREFS_DEFAULT } from "@/lib/ui-prefs";

const FORCE_LIGHT_KEY = "lexisPredict_force_light_v2";

export function ThemeBoot() {
  useEffect(() => {
    try {
      // Padrão operacional: sempre Minimal Steel light na primeira carga desta versão
      const forced = localStorage.getItem(FORCE_LIGHT_KEY);
      if (!forced) {
        localStorage.setItem(FORCE_LIGHT_KEY, "1");
        localStorage.setItem("lexisPredict_theme_preset", "minimal-steel");
        localStorage.setItem("theme", "light");
        localStorage.setItem("lexis_theme_mode", "light");
        localStorage.setItem("lexis_dark_mode", "false");
        localStorage.removeItem("lexisPredict_custom_theme");
        // limpa cores quebradas (branco em branco)
        localStorage.setItem("lexisPredict_bg_color", "#F8FAFC");
        localStorage.setItem("lexisPredict_bg_secondary_color", "#FFFFFF");
        localStorage.setItem("lexisPredict_font_color", "#0F172A");
        localStorage.setItem("lexisPredict_font_muted_color", "#475569");
      }

      document.documentElement.classList.remove("dark");
      const saved = getSavedPresetId();
      if (!saved || saved === "minimal-steel") {
        applyPresetById("minimal-steel", "light");
      } else if (saved === "custom-hardware") {
        applyStoredCustom("light");
      } else {
        applyPresetById(saved, "light");
      }

      // Reparo: se font color salva for clara demais, força slate
      const font = (localStorage.getItem("lexisPredict_font_color") || "").toLowerCase();
      if (
        !font ||
        font === "#ffffff" ||
        font === "#fff" ||
        font === "#f8fafc" ||
        font === "#f1f5f9" ||
        font === "#e2e8f0" ||
        font === "#fafafa"
      ) {
        localStorage.setItem("lexisPredict_font_color", "#0F172A");
        document.documentElement.style.setProperty("--foreground", "222 47% 11%");
        document.documentElement.style.setProperty("--card-foreground", "222 47% 11%");
      }

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

      localStorage.setItem("lexisPredict_bg_opacity", "1");
      localStorage.setItem("lexisPredict_sidebar_opacity", "1");
      localStorage.setItem("lexisPredict_glass_blur", "0");
      document.documentElement.style.setProperty("--bg-opacity", "1");
      document.documentElement.style.setProperty("--sidebar-opacity", "1");

      // CSS de contraste
      let el = document.getElementById("lexis-force-contrast") as HTMLStyleElement | null;
      if (!el) {
        el = document.createElement("style");
        el.id = "lexis-force-contrast";
        document.head.appendChild(el);
      }
      el.textContent = `
        html:not(.dark) body { color: #0f172a !important; background: #f8fafc !important; }
        html:not(.dark) .text-foreground { color: #0f172a !important; }
        html:not(.dark) .text-muted-foreground { color: #475569 !important; }
        html:not(.dark) .bg-card, html:not(.dark) [role="dialog"], html:not(.dark) [data-radix-dialog-content] {
          background: #fff !important; color: #0f172a !important; opacity: 1 !important; backdrop-filter: none !important;
        }
      `;
    } catch (e) {
      console.warn("[ThemeBoot]", e);
    }
  }, []);
  return null;
}

"use client";

import { useEffect } from "react";
import { applySavedPreset, getSavedPresetId } from "@/lib/theme";
import { loadUiPrefs, applyUiPrefsToDom } from "@/lib/ui-prefs";
import {EXPERIENCE_KEY,loadExperiencePrefs,applyExperiencePrefs} from '@/lib/experience-prefs';

/**
 * Aplica o tema salvo; nunca força claro, apaga a escolha ou impõe branco
 * sobre palettes SheetsPredict escuras. A paleta inicial já vem do layout.
 */
export function ThemeBoot() {
  useEffect(() => {
    try {
      const root = document.documentElement;
      // O perfil v4 é a fonte prioritária; o modo antigo só é usado para
      // usuários que ainda não configuraram sua experiência.
      if(localStorage.getItem(EXPERIENCE_KEY)){
        applyExperiencePrefs(loadExperiencePrefs());
        return;
      }
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

      // A preferência visual pertence ao usuário; não desligar Glass/Blur no login.
      applyUiPrefsToDom(loadUiPrefs());

      const legacyForce = document.getElementById("lexis-force-contrast");
      if (legacyForce) legacyForce.remove();
    } catch (error) {
      console.warn("[ThemeBoot]", error);
    }
  }, []);
  useEffect(()=>{
    const media=window.matchMedia('(prefers-color-scheme: dark)');
    const change=()=>{
      const p=loadExperiencePrefs();
      if(localStorage.getItem(EXPERIENCE_KEY)&&p.mode==='system')applyExperiencePrefs(p);
    };
    media.addEventListener?.('change',change);
    return()=>media.removeEventListener?.('change',change);
  },[]);
  return null;
}

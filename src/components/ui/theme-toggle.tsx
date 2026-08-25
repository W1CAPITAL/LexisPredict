"use client";

import { Laptop, Moon, Sun, Palette, Sparkles, Check } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAppStore } from "@/store/use-app-store";
import { cn } from "@/lib/utils";
import {
  AUTHORITY_PRESETS,
  applyPresetById,
  applySavedPreset,
  getSavedPresetId,
  getPresetColors,
  type ThemeMode,
} from "@/lib/theme";

export type LexisThemeMode = "light" | "dark" | "system";

function resolveSystemDark() {
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function currentMode(): ThemeMode {
  return document.documentElement.classList.contains("dark") ? "dark" : "light";
}

export function applyLexisThemeMode(mode: LexisThemeMode) {
  localStorage.setItem("lexis_theme_mode", mode);
  const isDark = mode === "dark" || (mode === "system" && resolveSystemDark());
  localStorage.setItem("lexis_dark_mode", String(isDark));
  const root = document.documentElement;
  root.classList.toggle("dark", isDark);
  root.classList.toggle("light", !isDark);
  // reaplica o preset salvo com a paleta do modo atual (ou limpa, se "sem tema")
  applySavedPreset(isDark ? "dark" : "light");
  return isDark;
}

export function selectThemePreset(id: string | null) {
  if (id) {
    applyPresetById(id, currentMode());
    localStorage.setItem("lexis_theme_preset", id);
  } else {
    localStorage.removeItem("lexis_theme_preset");
    applySavedPreset(currentMode());
  }
  window.dispatchEvent(new CustomEvent("lexis-theme-picked", { detail: id }));
}

export function ThemeToggle({ className }: { className?: string }) {
  const { setDarkMode } = useAppStore();
  const [mode, setMode] = useState<LexisThemeMode>("light");
  const [presetId, setPresetId] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const savedMode = (localStorage.getItem("lexis_theme_mode") as LexisThemeMode) || "light";
    setMode(savedMode);
    setDarkMode(applyLexisThemeMode(savedMode));
    setPresetId(getSavedPresetId());
  }, [setDarkMode]);

  useEffect(() => {
    if (mode !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => setDarkMode(applyLexisThemeMode("system"));
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [mode, setDarkMode]);

  useEffect(() => {
    const onPick = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (typeof detail === "string" || detail === null) setPresetId(detail);
    };
    window.addEventListener("lexis-theme-picked", onPick);
    return () => window.removeEventListener("lexis-theme-picked", onPick);
  }, []);

  async function chooseMode(next: LexisThemeMode) {
    const run = () => {
      setMode(next);
      setDarkMode(applyLexisThemeMode(next));
    };
    if (document.startViewTransition) {
      document.documentElement.style.viewTransitionName = "theme-transition";
      await document.startViewTransition(run).finished;
      document.documentElement.style.viewTransitionName = "";
    } else {
      run();
    }
  }

  function choosePreset(id: string | null) {
    selectThemePreset(id);
    setPresetId(id);
  }

  if (!mounted) {
    return (
      <Button variant="ghost" size="icon" className={cn("h-9 w-9", className)} aria-label="Tema">
        <Sun size={16} />
      </Button>
    );
  }

  const ModeIcon = mode === "dark" ? Moon : mode === "light" ? Sun : Laptop;
  const activePreset = AUTHORITY_PRESETS.find((p) => p.id === presetId);
  const isCustomHardware = presetId === "custom-hardware";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={cn("h-9 w-9", className)}
          aria-label="Tema e modo"
          title="Tema (Light / Dark / System + presets)"
        >
          <ModeIcon size={16} />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72 max-h-[80vh] overflow-y-auto">
        <DropdownMenuLabel className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
          Modo
        </DropdownMenuLabel>
        <div className="grid grid-cols-3 gap-1 px-2 pb-1">
          {(["light", "dark", "system"] as LexisThemeMode[]).map((m) => {
            const Icon = m === "light" ? Sun : m === "dark" ? Moon : Laptop;
            return (
              <button
                key={m}
                onClick={() => chooseMode(m)}
                className={cn(
                  "flex flex-col items-center gap-1 rounded-lg border px-2 py-2 text-[10px] font-bold uppercase tracking-wide transition-colors",
                  mode === m
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                )}
              >
                <Icon size={14} />
                {m}
              </button>
            );
          })}
        </div>

        <DropdownMenuSeparator />

        <DropdownMenuLabel className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
          <Palette size={12} /> Tema
        </DropdownMenuLabel>

        <DropdownMenuItem onClick={() => choosePreset(null)} className="flex items-center gap-2 py-2">
          <span className="h-3 w-3 rounded-full border border-border bg-background shadow-sm" />
          <span className="flex-1 text-[11px] font-bold uppercase tracking-wide">Padrão Orbit</span>
          {presetId === null && <Check size={14} className="text-primary" />}
        </DropdownMenuItem>

        {AUTHORITY_PRESETS.map((p) => {
          const active = p.id === presetId;
          const light = getPresetColors(p, "light");
          const dark = getPresetColors(p, "dark");
          return (
            <DropdownMenuItem
              key={p.id}
              onClick={() => choosePreset(p.id)}
              className="flex items-center gap-2 py-2"
            >
              <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-border shadow-sm" style={{ background: light.primary }}>
                <span className="h-2 w-2 rounded-full" style={{ background: dark.primary }} />
              </span>
              <span className="flex-1 text-[11px] font-bold uppercase tracking-wide">{p.name}</span>
              {active && <Check size={14} className="text-primary" />}
            </DropdownMenuItem>
          );
        })}

        <DropdownMenuSeparator />
        <DropdownMenuLabel className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-primary">
          <Sparkles size={12} />
          {isCustomHardware
            ? "Tema custom ativo (Hardware Visual)"
            : activePreset
              ? `${activePreset.name} ativo`
              : "Sem tema custom — Orbit padrão"}
        </DropdownMenuLabel>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

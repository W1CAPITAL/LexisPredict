"use client";

import { Laptop, Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAppStore } from "@/store/use-app-store";
import { cn } from "@/lib/utils";

export type LexisThemeMode = "light" | "dark" | "system";

function resolveSystemDark() {
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

export function applyLexisThemeMode(mode: LexisThemeMode) {
  localStorage.setItem("lexis_theme_mode", mode);
  const isDark = mode === "dark" || (mode === "system" && resolveSystemDark());
  localStorage.setItem("lexis_dark_mode", String(isDark));
  const root = document.documentElement;
  root.classList.toggle("dark", isDark);
  root.classList.toggle("light", !isDark);
  return isDark;
}

export function ThemeToggle({ className }: { className?: string }) {
  const { setDarkMode } = useAppStore();
  const [mode, setMode] = useState<LexisThemeMode>("system");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const saved = (localStorage.getItem("lexis_theme_mode") as LexisThemeMode) || "system";
    setMode(saved);
    setDarkMode(applyLexisThemeMode(saved));
  }, [setDarkMode]);

  useEffect(() => {
    if (mode !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => setDarkMode(applyLexisThemeMode("system"));
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [mode, setDarkMode]);

  async function choose(next: LexisThemeMode) {
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

  if (!mounted) {
    return (
      <Button variant="ghost" size="icon" className={cn("h-9 w-9", className)} aria-label="Tema">
        <Sun size={16} />
      </Button>
    );
  }

  const Icon = mode === "dark" ? Moon : mode === "light" ? Sun : Laptop;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={cn("h-9 w-9", className)}
          aria-label="Tema"
          title="Tema Orbit (Light / Dark / System)"
        >
          <Icon size={16} />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-40">
        <DropdownMenuItem onClick={() => choose("light")}>
          <Sun className="mr-2 h-4 w-4" /> Light
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => choose("dark")}>
          <Moon className="mr-2 h-4 w-4" /> Dark
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => choose("system")}>
          <Laptop className="mr-2 h-4 w-4" /> System
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

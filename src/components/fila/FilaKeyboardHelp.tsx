"use client";

import { useEffect, useState } from "react";
import { Keyboard } from "lucide-react";
import { cn } from "@/lib/utils";

const SHORTCUTS = [
  { keys: "J / ↓", action: "Próximo caso" },
  { keys: "K / ↑", action: "Caso anterior" },
  { keys: "Enter", action: "Abrir atendimento" },
  { keys: "?", action: "Mostrar/ocultar esta ajuda" },
];

/** Badge + painel de atalhos — visível no web, não só “descoberto”. */
export function FilaKeyboardHelp({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      if (e.key === "?" || (e.shiftKey && e.key === "/")) {
        e.preventDefault();
        setOpen((v) => !v);
      }
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className={cn("relative", className)}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1.5 h-9 px-3 rounded-xl border border-border/50 bg-secondary/30 text-[10px] font-black uppercase tracking-wider text-muted-foreground hover:text-foreground"
        title="Atalhos de teclado (?)"
        aria-expanded={open}
      >
        <Keyboard size={14} />
        <span className="hidden sm:inline">Atalhos</span>
        <kbd className="text-[9px] opacity-70">?</kbd>
      </button>
      {open && (
        <div
          className="absolute right-0 top-full mt-2 z-50 w-64 rounded-xl border border-border bg-card p-3 shadow-xl animate-in fade-in zoom-in-95"
          role="dialog"
          aria-label="Atalhos da fila"
        >
          <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-2">Teclado</p>
          <ul className="space-y-1.5">
            {SHORTCUTS.map((s) => (
              <li key={s.keys} className="flex items-center justify-between gap-2 text-[11px]">
                <kbd className="px-1.5 py-0.5 rounded bg-secondary font-mono text-[10px] font-bold">{s.keys}</kbd>
                <span className="text-muted-foreground font-medium">{s.action}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

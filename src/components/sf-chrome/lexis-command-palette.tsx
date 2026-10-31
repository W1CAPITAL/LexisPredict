"use client";

/**
 * Cmd+K estilo Salesforce / Twenty — atalho global para o Lexis real.
 * Não substitui scanner, auth nem carteira.
 */
import React, { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Search,
  LayoutDashboard,
  Briefcase,
  ListTodo,
  MessageCircle,
  FileText,
  Scale,
  Gavel,
  BarChart3,
  Settings,
  Upload,
  PauseCircle,
  ShieldAlert,
  Bot,
  CalendarDays,
} from "lucide-react";
import { cn } from "@/lib/utils";

type Item = { label: string; href: string; icon: React.ElementType; keywords?: string };

const ITEMS: Item[] = [
  { label: "Painel", href: "/", icon: LayoutDashboard, keywords: "dashboard home" },
  { label: "Meus processos", href: "/cases", icon: Briefcase, keywords: "carteira cnj" },
  { label: "Fila de contato", href: "/tarefas", icon: ListTodo, keywords: "tarefas fila" },
  { label: "Processos parados", href: "/processos-parados", icon: PauseCircle, keywords: "parado inércia" },
  { label: "WhatsApp", href: "/whatsapp", icon: MessageCircle, keywords: "terminal evolution" },
  { label: "Veredito", href: "/veredito", icon: Scale, keywords: "consulta cnj" },
  { label: "Busca e apreensão", href: "/busca-apreensao", icon: Gavel, keywords: "ba mandado" },
  { label: "Radar predatória", href: "/investigacao-predatoria", icon: ShieldAlert, keywords: "numopede" },
  { label: "Dossiê / Relatório", href: "/report", icon: BarChart3, keywords: "report" },
  { label: "Agenda", href: "/agenda", icon: CalendarDays, keywords: "prazos" },
  { label: "Documentos", href: "/documents", icon: FileText, keywords: "procuracao" },
  { label: "Superagente", href: "/chat", icon: Bot, keywords: "ia chatbot investigacao dossie atendimento relatorio predictlm" },
  { label: "Importar", href: "/import", icon: Upload, keywords: "csv planilha" },
  { label: "Configurações", href: "/settings", icon: Settings, keywords: "senha tema" },
];

export function LexisCommandPalette() {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const returnFocus = useRef<HTMLElement | null>(null);
  const router = useRouter();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        if (!open) returnFocus.current = document.activeElement as HTMLElement | null;
        setOpen((v) => !v);
        setQ("");
        setActiveIndex(0);
      }
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  useEffect(() => {
    if (!open && returnFocus.current) {
      returnFocus.current.focus();
      returnFocus.current = null;
    }
  }, [open]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return ITEMS;
    return ITEMS.filter(
      (i) =>
        i.label.toLowerCase().includes(s) ||
        i.href.includes(s) ||
        (i.keywords || "").includes(s)
    );
  }, [q]);

  const go = useCallback(
    (href: string) => {
      setOpen(false);
      router.push(href);
    },
    [router]
  );

  const onSearchKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown" && filtered.length) {
      event.preventDefault();
      setActiveIndex((index) => (index + 1) % filtered.length);
    } else if (event.key === "ArrowUp" && filtered.length) {
      event.preventDefault();
      setActiveIndex((index) => (index - 1 + filtered.length) % filtered.length);
    } else if (event.key === "Home" && filtered.length) {
      event.preventDefault();
      setActiveIndex(0);
    } else if (event.key === "End" && filtered.length) {
      event.preventDefault();
      setActiveIndex(filtered.length - 1);
    } else if (event.key === "Enter" && filtered.length) {
      event.preventDefault();
      go(filtered[Math.min(activeIndex, filtered.length - 1)].href);
    }
  };

  if (!open) return null;

  return (
    <div
      data-lexis-buildindex-palette-backdrop
      className="fixed inset-0 z-[200] flex items-start justify-center bg-black/40 pt-[12vh] px-4"
      onClick={() => setOpen(false)}
      role="dialog"
      aria-modal="true"
      aria-label="Busca rápida"
    >
      <div
        data-lexis-buildindex-palette
        className="w-full max-w-lg rounded-xl border border-border bg-card shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 px-3 border-b border-border">
          <Search className="size-4 text-muted-foreground shrink-0" />
          <input
            autoFocus
            value={q}
            onChange={(e) => { setQ(e.target.value); setActiveIndex(0); }}
            onKeyDown={onSearchKeyDown}
            role="combobox"
            aria-autocomplete="list"
            aria-expanded="true"
            aria-controls="lexis-quick-navigation-results"
            aria-activedescendant={filtered.length ? `lexis-quick-option-${Math.min(activeIndex, filtered.length - 1)}` : undefined}
            placeholder="Ir para… (Ctrl/Cmd+K)"
            className="flex-1 h-12 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
          <kbd className="text-[10px] text-muted-foreground border border-border rounded px-1.5 py-0.5">ESC</kbd>
        </div>
        <ul id="lexis-quick-navigation-results" role="listbox" aria-label="Destinos disponíveis" className="max-h-72 overflow-auto py-1">
          {filtered.map((item, index) => {
            const Icon = item.icon;
            return (
              <li key={item.href}>
                <button
                  id={`lexis-quick-option-${index}`}
                  role="option"
                  aria-selected={activeIndex === index}
                  data-lexis-buildindex-option
                  data-active={activeIndex === index ? "true" : "false"}
                  onMouseEnter={() => setActiveIndex(index)}
                  type="button"
                  onClick={() => go(item.href)}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2.5 text-left text-sm",
                    "hover:bg-muted/80 transition-colors"
                  )}
                >
                  <Icon className="size-4 text-muted-foreground" />
                  <span className="font-medium">{item.label}</span>
                  <span className="ml-auto text-[10px] text-muted-foreground font-mono">{item.href}</span>
                </button>
              </li>
            );
          })}
          {filtered.length === 0 && (
            <li className="px-3 py-6 text-center text-sm text-muted-foreground">Nada encontrado</li>
          )}
        </ul>
        <div data-lexis-buildindex-palette-footer className="flex items-center justify-between border-t border-border/60 px-4 py-2 text-[10px] text-muted-foreground">
          <span>↑ ↓ escolher · Enter abrir</span><span>Esc fechar</span>
        </div>
      </div>
    </div>
  );
}

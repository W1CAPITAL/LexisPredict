"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Building2, Users, Handshake, LayoutDashboard, Search, RotateCcw, Command } from "lucide-react";
import { cn } from "@/lib/format";
import { useCrmStore } from "@/store/crm-store";
import { useEffect, useState, useCallback } from "react";
import { CommandPalette } from "./command-palette";

const NAV = [
  { href: "/", label: "Início", icon: LayoutDashboard, key: "g h" },
  { href: "/companies", label: "Empresas", icon: Building2, key: "g c" },
  { href: "/people", label: "Clientes", icon: Users, key: "g p" },
  { href: "/deals", label: "Oportunidades", icon: Handshake, key: "g d" },
];

export function Shell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  const resetDemo = useCrmStore((s) => s.resetDemo);
  const [cmdOpen, setCmdOpen] = useState(false);

  const onKey = useCallback(
    (e: KeyboardEvent) => {
      const meta = e.metaKey || e.ctrlKey;
      if (meta && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setCmdOpen(true);
        return;
      }
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      // g then letter
      if ((window as any).__gPending) {
        const second = e.key.toLowerCase();
        (window as any).__gPending = false;
        if (second === "h") router.push("/");
        if (second === "c") router.push("/companies");
        if (second === "p") router.push("/people");
        if (second === "d") router.push("/deals");
        return;
      }
      if (e.key.toLowerCase() === "g") {
        (window as any).__gPending = true;
        setTimeout(() => {
          (window as any).__gPending = false;
        }, 800);
      }
    },
    [router]
  );

  useEffect(() => {
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onKey]);

  return (
    <div className="min-h-screen flex">
      <aside className="w-56 shrink-0 border-r border-ink-200 bg-white flex flex-col">
        <div className="px-4 py-5 flex items-center gap-2">
          <div className="size-8 rounded-lg bg-accent text-white grid place-items-center font-semibold text-sm">L</div>
          <div>
            <p className="text-sm font-semibold tracking-tight">Lexis CRM</p>
            <p className="text-[10px] text-ink-400 uppercase tracking-widest">Test build</p>
          </div>
        </div>
        <nav className="px-2 space-y-0.5 flex-1">
          {NAV.map((item) => {
            const active = path === item.href || (item.href !== "/" && path.startsWith(item.href));
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors",
                  active ? "bg-accent-soft text-accent font-medium" : "text-ink-600 hover:bg-ink-50"
                )}
              >
                <Icon className="size-4 opacity-80" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="p-3 border-t border-ink-100 space-y-2">
          <button
            type="button"
            onClick={() => setCmdOpen(true)}
            className="w-full flex items-center gap-2 rounded-lg border border-ink-200 bg-ink-50 px-3 py-2 text-xs text-ink-500 hover:bg-white"
          >
            <Search className="size-3.5" />
            Buscar
            <span className="ml-auto flex items-center gap-0.5 text-[10px] text-ink-400">
              <Command className="size-3" />K
            </span>
          </button>
          <button
            type="button"
            onClick={() => {
              if (confirm("Restaurar dados de demonstração?")) resetDemo();
            }}
            className="w-full flex items-center gap-2 rounded-lg px-3 py-2 text-xs text-ink-500 hover:bg-ink-50"
          >
            <RotateCcw className="size-3.5" />
            Reset demo
          </button>
        </div>
      </aside>
      <main className="flex-1 min-w-0 flex flex-col">
        <header className="h-12 border-b border-ink-200 bg-white/80 backdrop-blur px-6 flex items-center justify-between sticky top-0 z-10">
          <p className="text-xs text-ink-400">
            Atalhos: <kbd className="px-1.5 py-0.5 rounded bg-ink-100 text-ink-600">⌘K</kbd> busca ·{" "}
            <kbd className="px-1.5 py-0.5 rounded bg-ink-100 text-ink-600">g</kbd> depois{" "}
            <kbd className="px-1.5 py-0.5 rounded bg-ink-100 text-ink-600">h/c/p/d</kbd>
          </p>
          <span className="text-[11px] text-ink-400">Dados no navegador (localStorage)</span>
        </header>
        <div className="flex-1 p-6">{children}</div>
      </main>
      <CommandPalette open={cmdOpen} onClose={() => setCmdOpen(false)} />
    </div>
  );
}

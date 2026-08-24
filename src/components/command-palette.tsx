"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useCrmStore } from "@/store/crm-store";
import { Building2, Users, Handshake, LayoutDashboard } from "lucide-react";

export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const { companies, people, deals } = useCrmStore();
  const [q, setQ] = useState("");

  useEffect(() => {
    if (!open) setQ("");
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onEsc);
    return () => window.removeEventListener("keydown", onEsc);
  }, [open, onClose]);

  const results = useMemo(() => {
    const s = q.trim().toLowerCase();
    const items: { type: string; label: string; href: string; icon: typeof Building2 }[] = [
      { type: "nav", label: "Início", href: "/", icon: LayoutDashboard },
      { type: "nav", label: "Empresas", href: "/companies", icon: Building2 },
      { type: "nav", label: "Clientes", href: "/people", icon: Users },
      { type: "nav", label: "Oportunidades", href: "/deals", icon: Handshake },
    ];
    if (!s) return items.slice(0, 8);
    for (const c of companies) {
      if (c.name.toLowerCase().includes(s) || c.domain?.toLowerCase().includes(s)) {
        items.push({ type: "empresa", label: c.name, href: `/companies/${c.id}`, icon: Building2 });
      }
    }
    for (const p of people) {
      if (p.name.toLowerCase().includes(s) || p.email?.toLowerCase().includes(s)) {
        items.push({ type: "cliente", label: p.name, href: `/people?id=${p.id}`, icon: Users });
      }
    }
    for (const d of deals) {
      if (d.name.toLowerCase().includes(s)) {
        items.push({ type: "deal", label: d.name, href: `/deals?id=${d.id}`, icon: Handshake });
      }
    }
    return items.filter((i) => i.type === "nav" || true).slice(0, 12);
  }, [q, companies, people, deals]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/30 backdrop-blur-[2px] flex items-start justify-center pt-[15vh] px-4" onClick={onClose}>
      <div
        className="w-full max-w-lg rounded-xl bg-white shadow-panel border border-ink-200 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <input
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar empresas, clientes, deals…"
          className="w-full px-4 py-3.5 text-sm border-b border-ink-100 outline-none"
        />
        <ul className="max-h-80 overflow-auto py-2">
          {results.map((r, i) => {
            const Icon = r.icon;
            return (
              <li key={`${r.href}-${i}`}>
                <button
                  type="button"
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm hover:bg-accent-soft"
                  onClick={() => {
                    router.push(r.href);
                    onClose();
                  }}
                >
                  <Icon className="size-4 text-ink-400" />
                  <span className="flex-1 truncate">{r.label}</span>
                  <span className="text-[10px] uppercase tracking-wider text-ink-400">{r.type}</span>
                </button>
              </li>
            );
          })}
          {results.length === 0 && <li className="px-4 py-6 text-center text-sm text-ink-400">Nada encontrado</li>}
        </ul>
      </div>
    </div>
  );
}

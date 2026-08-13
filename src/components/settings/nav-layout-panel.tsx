"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  NAV_CATALOG,
  loadNavPreferences,
  saveNavPreferences,
  type NavPreferences,
} from "@/lib/nav-preferences";
import { useAuth } from "@/components/auth/auth-provider";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { ChevronDown, ChevronUp, Eye, EyeOff, Pin, RotateCcw } from "lucide-react";

/**
 * Configurações: ordem global, ocultar, e fixar fora de "Mais ferramentas".
 */
export function NavLayoutPanel() {
  const { profile } = useAuth();
  const userId =
    (profile as any)?.auth_user_id || (profile as any)?.id || null;

  const [prefs, setPrefs] = useState<NavPreferences>({
    hidden: [],
    order: [],
    pinned: [],
  });
  const [order, setOrder] = useState<string[]>([]);

  useEffect(() => {
    const p = loadNavPreferences(userId);
    setPrefs(p);
    setOrder(p.order.length ? p.order : NAV_CATALOG.map((c) => c.href));
  }, [userId]);

  const hiddenSet = useMemo(() => new Set(prefs.hidden || []), [prefs.hidden]);
  const pinnedSet = useMemo(() => new Set(prefs.pinned || []), [prefs.pinned]);

  const persist = (next: NavPreferences) => {
    setPrefs(next);
    saveNavPreferences(next, userId);
  };

  const toggleHidden = (href: string, hide: boolean) => {
    const hidden = new Set(prefs.hidden || []);
    if (hide) hidden.add(href);
    else hidden.delete(href);
    hidden.delete("/settings");
    persist({ ...prefs, hidden: Array.from(hidden) });
  };

  const togglePinned = (href: string, on: boolean) => {
    const pinned = new Set(prefs.pinned || []);
    if (on) pinned.add(href);
    else pinned.delete(href);
    persist({ ...prefs, pinned: Array.from(pinned) });
  };

  const move = (href: string, dir: -1 | 1) => {
    const idx = order.indexOf(href);
    if (idx < 0) return;
    const j = idx + dir;
    if (j < 0 || j >= order.length) return;
    const next = [...order];
    [next[idx], next[j]] = [next[j], next[idx]];
    setOrder(next);
    persist({ ...prefs, order: next });
  };

  const reset = () => {
    const empty = { hidden: [], order: [], pinned: [] };
    setOrder(NAV_CATALOG.map((c) => c.href));
    persist(empty);
  };

  // Lista na ordem global (plana) — não por seção
  const orderedCatalog = useMemo(() => {
    const byHref = new Map(NAV_CATALOG.map((c) => [c.href, c]));
    const list: typeof NAV_CATALOG = [];
    for (const h of order) {
      const c = byHref.get(h);
      if (c) list.push(c);
    }
    for (const c of NAV_CATALOG) {
      if (!order.includes(c.href)) list.push(c);
    }
    return list;
  }, [order]);

  return (
    <Card className="border border-border/60 rounded-2xl shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold">Menu lateral</CardTitle>
        <p className="text-xs text-muted-foreground font-normal leading-relaxed">
          Ordem livre (sem blocos Carteira/Gestão). Use o pino para deixar uma
          ferramenta sempre visível, mesmo com “Mais ferramentas” desligado.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex justify-end">
          <Button type="button" variant="outline" size="sm" onClick={reset} className="gap-1.5">
            <RotateCcw size={14} />
            Restaurar padrão
          </Button>
        </div>

        <ul className="space-y-1.5">
          {orderedCatalog.map((it) => {
            const hidden = hiddenSet.has(it.href);
            const pinned = pinnedSet.has(it.href);
            const locked = it.href === "/settings";
            return (
              <li
                key={it.href}
                className={cn(
                  "flex items-center gap-2 rounded-xl border border-border/50 px-3 py-2 bg-card",
                  hidden && "opacity-55"
                )}
              >
                <span className="flex-1 min-w-0">
                  <span className="text-sm font-medium block truncate">{it.label}</span>
                  <span className="text-[10px] text-muted-foreground font-mono truncate block">
                    {it.href}
                    {it.moreTools ? " · ferramentas" : ""}
                  </span>
                </span>
                <div className="flex items-center gap-0.5 shrink-0">
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8"
                    onClick={() => move(it.href, -1)}
                    title="Subir"
                  >
                    <ChevronUp size={14} />
                  </Button>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8"
                    onClick={() => move(it.href, 1)}
                    title="Descer"
                  >
                    <ChevronDown size={14} />
                  </Button>
                  {it.moreTools ? (
                    <Button
                      type="button"
                      size="icon"
                      variant={pinned ? "secondary" : "ghost"}
                      className={cn("h-8 w-8", pinned && "text-primary")}
                      title="Sempre visível (ignora Mais ferramentas)"
                      onClick={() => togglePinned(it.href, !pinned)}
                    >
                      <Pin size={14} className={pinned ? "fill-current" : ""} />
                    </Button>
                  ) : (
                    <span className="w-8" />
                  )}
                  <div className="flex items-center gap-1.5 pl-1 border-l border-border/40 ml-0.5">
                    {hidden ? (
                      <EyeOff size={14} className="text-muted-foreground" />
                    ) : (
                      <Eye size={14} className="text-muted-foreground" />
                    )}
                    <Switch
                      checked={!hidden}
                      disabled={locked}
                      onCheckedChange={(on) => toggleHidden(it.href, !on)}
                    />
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}

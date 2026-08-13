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
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { ChevronDown, ChevronUp, Eye, EyeOff, RotateCcw } from "lucide-react";

/**
 * Módulo Configurações: ocultar abas e reordenar o menu lateral (por usuário).
 */
export function NavLayoutPanel() {
  const { profile } = useAuth();
  const userId =
    (profile as any)?.auth_user_id || (profile as any)?.id || null;

  const [prefs, setPrefs] = useState<NavPreferences>(DEFAULT_EMPTY);
  const [order, setOrder] = useState<string[]>([]);

  useEffect(() => {
    const p = loadNavPreferences(userId);
    setPrefs(p);
    setOrder(
      p.order.length
        ? p.order
        : NAV_CATALOG.map((c) => c.href)
    );
  }, [userId]);

  const hiddenSet = useMemo(() => new Set(prefs.hidden || []), [prefs.hidden]);

  const persist = (next: NavPreferences) => {
    setPrefs(next);
    saveNavPreferences(next, userId);
  };

  const toggleHidden = (href: string, hide: boolean) => {
    const hidden = new Set(prefs.hidden || []);
    if (hide) hidden.add(href);
    else hidden.delete(href);
    // Configurações nunca some
    hidden.delete("/settings");
    persist({ ...prefs, hidden: Array.from(hidden) });
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
    const empty = { hidden: [], order: [] };
    setOrder(NAV_CATALOG.map((c) => c.href));
    persist(empty);
  };

  const byGroup = useMemo(() => {
    const map = new Map<string, typeof NAV_CATALOG>();
    for (const item of NAV_CATALOG) {
      const list = map.get(item.group) || [];
      list.push(item);
      map.set(item.group, list);
    }
    return map;
  }, []);

  return (
    <Card className="border border-border/60 rounded-2xl shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold">
          Menu lateral · abas por perfil
        </CardTitle>
        <p className="text-xs text-muted-foreground font-normal">
          Oculte abas ou mude a ordem só neste usuário (salvo no navegador). Não
          altera permissões de cargo.
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex justify-end">
          <Button type="button" variant="outline" size="sm" onClick={reset} className="gap-1.5">
            <RotateCcw size={14} />
            Restaurar padrão
          </Button>
        </div>

        {Array.from(byGroup.entries()).map(([group, items]) => (
          <div key={group} className="space-y-2">
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              {group}
            </p>
            <ul className="space-y-1.5">
              {items.map((it) => {
                const hidden = hiddenSet.has(it.href);
                const locked = it.href === "/settings";
                return (
                  <li
                    key={it.href}
                    className={cn(
                      "flex items-center gap-2 rounded-xl border border-border/50 px-3 py-2 bg-card",
                      hidden && "opacity-60"
                    )}
                  >
                    <span className="flex-1 text-sm font-medium truncate">
                      {it.label}
                      <span className="text-[10px] text-muted-foreground ml-2 font-mono">
                        {it.href}
                      </span>
                    </span>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8"
                        onClick={() => move(it.href, -1)}
                        title="Subir na ordem"
                      >
                        <ChevronUp size={14} />
                      </Button>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8"
                        onClick={() => move(it.href, 1)}
                        title="Descer na ordem"
                      >
                        <ChevronDown size={14} />
                      </Button>
                      <div className="flex items-center gap-2 pl-2 border-l border-border/40">
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
                        <Label className="text-[10px] text-muted-foreground sr-only">
                          Visível
                        </Label>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

const DEFAULT_EMPTY: NavPreferences = { hidden: [], order: [] };

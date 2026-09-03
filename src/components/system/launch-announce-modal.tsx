"use client";

/**
 * Anúncio ao abrir / após atualizar — fechável.
 * Imagem promocional + Coming soon Offline + changelog curto.
 */
import React, { useEffect, useState } from "react";
import Link from "next/link";
import { X, Monitor, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RELEASE_VERSION, RELEASE_CHANGELOG } from "@/lib/release-feed";

const KEY = "lexis_announce_seen_";
const SNOOZE = "lexis_announce_snooze_until";
const SNOOZE_MS = 72 * 3600 * 1000; // 3 dias — reaparece sem ser a cada F5

export function LaunchAnnounceModal() {
  const [open, setOpen] = useState(false);
  const seenKey = KEY + RELEASE_VERSION;

  useEffect(() => {
    try {
      if (typeof window === "undefined") return;
      const snooze = Number(window.localStorage.getItem(SNOOZE) || 0);
      if (snooze && Date.now() < snooze) return;
      // Versão nova: mostra. Mesma versão: só se já passou o snooze (não a cada reload).
      if (window.localStorage.getItem(seenKey) === "1" && snooze && Date.now() < snooze) return;
      if (window.localStorage.getItem(seenKey) === "1") return;
      const t = window.setTimeout(() => setOpen(true), 900);
      return () => window.clearTimeout(t);
    } catch {
      /* */
    }
  }, [seenKey]);

  const close = (snoozeDays = 3) => {
    try {
      localStorage.setItem(seenKey, "1");
      localStorage.setItem(SNOOZE, String(Date.now() + snoozeDays * 86400000));
    } catch {
      /* */
    }
    setOpen(false);
  };

  if (!open) return null;

  const bullets = RELEASE_CHANGELOG.slice(0, 4);

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/55 backdrop-blur-sm"
        aria-label="Fechar anúncio"
        onClick={() => close()}
      />
      <div
        role="dialog"
        aria-labelledby="lexis-announce-title"
        className="relative z-[121] w-full max-w-lg overflow-hidden rounded-2xl border border-border bg-card shadow-2xl"
      >
        <img
          src="/lexis-promo-offline.svg"
          alt="LexisPredict Offline coming soon"
          className="h-36 w-full object-cover object-left"
        />
        <button
          type="button"
          onClick={() => close()}
          className="absolute right-3 top-3 h-8 w-8 rounded-full bg-black/50 text-white inline-flex items-center justify-center"
          aria-label="Fechar"
        >
          <X size={16} />
        </button>
        <div className="p-5 space-y-3">
          <p className="text-[9px] font-black uppercase tracking-[0.2em] text-cyan-600 dark:text-cyan-400 flex items-center gap-1.5">
            <Sparkles size={12} /> Atualização {RELEASE_VERSION}
          </p>
          <h2 id="lexis-announce-title" className="text-xl font-black tracking-tight">
            LexisPredict Offline — Coming soon
          </h2>
          <p className="text-[13px] text-muted-foreground leading-relaxed">
            O EXE Windows já roda (login, senha e planilha). A paridade com este
            app web entra no próximo ciclo. Pode fechar este aviso quando quiser.
          </p>
          <ul className="text-[12px] space-y-1 text-muted-foreground">
            {bullets.map((b) => (
              <li key={b} className="pl-3 border-l-2 border-primary/40">
                {b}
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap gap-2 pt-1">
            <Button asChild className="h-9 rounded-xl font-black uppercase text-[10px]">
              <Link href="/offline" onClick={() => close()}>
                <Monitor className="mr-2 h-4 w-4" />
                Ver Offline
              </Link>
            </Button>
            <Button type="button" variant="outline" className="h-9 rounded-xl font-black uppercase text-[10px]" onClick={() => close(3)}>
              Fechar · 3 dias
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

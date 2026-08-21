"use client";

/**
 * Anúncio compacto: gabinete desktop (EXE) mais rápido que o navegador.
 * Some se já estiver no EXE (window.lexisDesktop) ou se o usuário dispensou.
 */
import React, { useEffect, useState } from "react";
import { Monitor, X, ArrowUpRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

const DISMISS_KEY = "lexis_desktop_banner_dismissed_v21";

declare global {
  interface Window {
    lexisDesktop?: { isDesktop?: boolean; version?: string };
  }
}

export function DesktopDownloadBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      if (typeof window === "undefined") return;
      if (window.lexisDesktop?.isDesktop) return;
      if (/LexisGabineteDesktop/i.test(navigator.userAgent || "")) return;
      if (localStorage.getItem(DISMISS_KEY) === "1") return;
      // Só depois do primeiro paint — não compete com boot
      const t = window.setTimeout(() => setVisible(true), 2200);
      return () => window.clearTimeout(t);
    } catch {
      /* */
    }
  }, []);

  if (!visible) return null;

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* */
    }
    setVisible(false);
  };

  return (
    <div
      role="status"
      className="fixed bottom-4 right-4 z-[90] max-w-[min(100vw-1.5rem,22rem)] animate-in fade-in slide-in-from-bottom-2 duration-300"
    >
      <div className="rounded-xl border border-border/80 bg-card/95 shadow-lg backdrop-blur-md supports-[backdrop-filter]:bg-card/85">
        <div className="flex items-start gap-3 p-3.5">
          <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Monitor className="h-4 w-4" strokeWidth={1.75} />
          </div>
          <div className="min-w-0 flex-1 space-y-1.5">
            <p className="text-sm font-semibold leading-snug tracking-tight">
              Gabinete Desktop
            </p>
            <p className="text-xs leading-relaxed text-muted-foreground">
              EXE nativo com GPU desta máquina — em geral mais rápido e estável
              que a aba do navegador. As chaves continuam no servidor.
            </p>
            <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
              <Button type="button" size="sm" className="h-8 gap-1.5 text-xs font-semibold" asChild>
                <Link href="/desktop">
                  Ver como instalar
                  <ArrowUpRight className="h-3.5 w-3.5" />
                </Link>
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-8 text-xs"
                onClick={dismiss}
              >
                Agora não
              </Button>
            </div>
          </div>
          <button
            type="button"
            aria-label="Fechar"
            onClick={dismiss}
            className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

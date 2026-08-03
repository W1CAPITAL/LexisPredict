"use client";

/**
 * Detecta deploy novo (buildId diferente) e pede ao usuário recarregar.
 */
import React, { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { RefreshCcw, X, Sparkles } from "lucide-react";

const STORAGE_KEY = "lexis_app_build_id";
const POLL_MS = 90_000; // 1,5 min

export function AppUpdateBanner() {
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  const check = useCallback(async () => {
    if (dismissed) return;
    try {
      const res = await fetch(`/api/version?t=${Date.now()}`, {
        cache: "no-store",
      });
      if (!res.ok) return;
      const data = await res.json();
      const remote = String(data.buildId || "");
      if (!remote || remote === "dev") return;

      const local = sessionStorage.getItem(STORAGE_KEY);
      if (!local) {
        sessionStorage.setItem(STORAGE_KEY, remote);
        return;
      }
      if (local !== remote) {
        setVisible(true);
      }
    } catch {
      /* offline / cold start */
    }
  }, [dismissed]);

  useEffect(() => {
    check();
    const id = setInterval(check, POLL_MS);
    const onFocus = () => check();
    window.addEventListener("focus", onFocus);
    return () => {
      clearInterval(id);
      window.removeEventListener("focus", onFocus);
    };
  }, [check]);

  if (!visible) return null;

  return (
    <div
      role="status"
      className="fixed bottom-4 left-1/2 z-[200] w-[min(92vw,420px)] -translate-x-1/2 rounded-2xl border border-primary/40 bg-card/95 p-4 shadow-2xl backdrop-blur-xl"
    >
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
          <Sparkles size={18} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-black uppercase tracking-wide">Nova versão disponível</p>
          <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
            O LexisPredict foi atualizado. Recarregue a página para usar as correções e evitar erros
            de cache.
          </p>
          <div className="mt-3 flex gap-2">
            <Button
              size="sm"
              className="h-9 rounded-xl font-black uppercase text-[10px] tracking-widest gap-1"
              onClick={() => {
                sessionStorage.removeItem(STORAGE_KEY);
                window.location.reload();
              }}
            >
              <RefreshCcw size={14} />
              Recarregar agora
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-9 rounded-xl text-[10px] font-bold uppercase"
              onClick={() => {
                setDismissed(true);
                setVisible(false);
              }}
            >
              Depois
            </Button>
          </div>
        </div>
        <button
          type="button"
          className="text-muted-foreground hover:text-foreground"
          onClick={() => {
            setDismissed(true);
            setVisible(false);
          }}
          aria-label="Fechar"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
}

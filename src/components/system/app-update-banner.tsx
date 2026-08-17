"use client";

/**
 * Aviso forçado de nova versão (deploy Vercel) + o que foi adicionado.
 */
import React, { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { RefreshCcw, X, Sparkles } from "lucide-react";

const STORAGE_KEY = "lexis_app_build_id";
const POLL_MS = 45_000;

export function AppUpdateBanner() {
  const [visible, setVisible] = useState(false);
  const [remoteId, setRemoteId] = useState<string | null>(null);
  const [changelog, setChangelog] = useState<string[]>([]);

  const check = useCallback(async () => {
    try {
      const res = await fetch(`/api/version?t=${Date.now()}`, {
        cache: "no-store",
        headers: { "Cache-Control": "no-cache" },
      });
      if (!res.ok) return;
      const data = await res.json();
      const remote = String(data.buildId || "").trim();
      if (!remote || remote === "dev") return;

      const notes: string[] = Array.isArray(data.changelog)
        ? data.changelog.map(String)
        : data.whatsNew
          ? [String(data.whatsNew)]
          : [];

      const local = localStorage.getItem(STORAGE_KEY);
      if (!local) {
        localStorage.setItem(STORAGE_KEY, remote);
        return;
      }
      if (local !== remote) {
        setRemoteId(remote);
        setChangelog(notes);
        setVisible(true);
      }
    } catch {
      /* offline */
    }
  }, []);

  useEffect(() => {
    check();
    const t1 = setTimeout(check, 2500);
    const t2 = setTimeout(check, 8000);
    const id = setInterval(check, POLL_MS);
    const onFocus = () => check();
    const onVis = () => {
      if (document.visibilityState === "visible") check();
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearInterval(id);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [check]);

  if (!visible) return null;

  return (
    <div
      role="alert"
      className="fixed inset-x-0 top-0 z-[9999] flex justify-center p-3 pointer-events-none"
    >
      <div className="pointer-events-auto w-[min(96vw,560px)] rounded-2xl border-2 border-primary bg-background p-4 shadow-2xl">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Sparkles size={20} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-black uppercase tracking-wide text-foreground">
              Nova versão do LexisPredict
            </p>
            <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
              O app foi atualizado. Recarregue para usar as novidades abaixo.
            </p>
            {changelog.length > 0 ? (
              <ul className="mt-2 space-y-1 text-[11px] text-foreground/90 list-disc pl-4">
                {changelog.map((line, i) => (
                  <li key={i}>{line}</li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-[11px] text-muted-foreground">
                Correções e melhorias desta publicação.
              </p>
            )}
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                size="sm"
                className="h-10 rounded-xl font-black uppercase text-[10px] tracking-widest gap-1.5"
                onClick={() => {
                  if (remoteId) localStorage.setItem(STORAGE_KEY, remoteId);
                  else localStorage.removeItem(STORAGE_KEY);
                  window.location.reload();
                }}
              >
                <RefreshCcw size={14} />
                Recarregar agora
              </Button>
            </div>
          </div>
          <button
            type="button"
            className="text-muted-foreground hover:text-foreground p-1"
            aria-label="Fechar"
            onClick={() => setVisible(false)}
          >
            <X size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}

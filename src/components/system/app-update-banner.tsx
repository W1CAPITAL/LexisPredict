"use client";

/**
 * Nova versão do LexisPredict — detecta deploy e mostra changelog em tempo real.
 */
import React, { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { RefreshCcw, X, Sparkles } from "lucide-react";

const STORAGE_KEY = "lexis_app_build_id";
const POLL_MS = 5 * 60 * 1000; // 5 min — menos tráfego

export function AppUpdateBanner() {
  const [visible, setVisible] = useState(false);
  const [remoteId, setRemoteId] = useState<string | null>(null);
  const [title, setTitle] = useState("Nova versão do LexisPredict");
  const [subtitle, setSubtitle] = useState(
    "O app foi atualizado. Recarregue para usar as novidades abaixo."
  );
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
      if (!remote || remote.startsWith("dev")) return;

      const notes: string[] = Array.isArray(data.changelog)
        ? data.changelog.map(String).filter(Boolean)
        : data.whatsNew
          ? [String(data.whatsNew)]
          : [];

      if (data.title) setTitle(String(data.title));
      if (data.subtitle) setSubtitle(String(data.subtitle));

      const local = localStorage.getItem(STORAGE_KEY);
      if (!local) {
        // primeira visita deste browser: grava e não interrompe
        localStorage.setItem(STORAGE_KEY, remote);
        return;
      }
      if (local !== remote) {
        setRemoteId(remote);
        setChangelog(notes);
        setVisible(true);
        try { window.dispatchEvent(new Event("lexis-release-check")); } catch { /* */ }
      }
    } catch {
      /* offline */
    }
  }, []);

  useEffect(() => {
    check();
    const t1 = setTimeout(check, 1500);
    const t2 = setTimeout(check, 6000);
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

  const reload = () => {
    if (remoteId) localStorage.setItem(STORAGE_KEY, remoteId);
    window.location.reload();
  };

  const dismiss = () => {
    if (remoteId) localStorage.setItem(STORAGE_KEY, remoteId);
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div
      role="alert"
      className="fixed inset-x-0 top-0 z-[9999] flex justify-center p-3 pointer-events-none"
    >
      <div className="pointer-events-auto w-[min(96vw,640px)] max-h-[85vh] overflow-y-auto rounded-2xl border-2 border-primary bg-background p-4 shadow-2xl">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Sparkles className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-sm font-black tracking-tight">{title}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>
                {remoteId && (
                  <p className="text-[10px] text-muted-foreground/80 mt-1 font-mono">
                    build {remoteId}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={dismiss}
                className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted"
                aria-label="Dispensar"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            {changelog.length > 0 && (
              <ul className="space-y-1.5 rounded-xl border border-border/60 bg-muted/30 p-3 text-xs">
                {changelog.map((line, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="text-primary font-black shrink-0">•</span>
                    <span>{line}</span>
                  </li>
                ))}
              </ul>
            )}
            <div className="flex flex-wrap gap-2 pt-1">
              <Button type="button" size="sm" className="gap-2 font-bold" onClick={reload}>
                <RefreshCcw className="h-3.5 w-3.5" />
                Recarregar agora
              </Button>
              <Button type="button" size="sm" variant="ghost" onClick={dismiss}>
                Depois
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

"use client";

/**
 * Indicador global: se a carteira híbrida está sincronizada com a planilha.
 * Visível no chrome (canto) e detalhado em /plano-b.
 */

import { useCallback, useEffect, useState } from "react";
import { hybridStatusAction, hybridAutoSyncAction } from "@/app/actions/hybrid-sync-actions";
import { useAuth } from "@/components/auth/auth-provider";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { RefreshCw, Sheet, CheckCircle2, AlertTriangle, CircleDashed } from "lucide-react";

type St = Awaited<ReturnType<typeof hybridStatusAction>>;

export function HybridSyncBadge({ compact = true }: { compact?: boolean }) {
  const { profile } = useAuth();
  const [st, setSt] = useState<St | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setSt(await hybridStatusAction());
    } catch {
      setSt(null);
    }
  }, []);

  useEffect(() => {
    if (!profile) return;
    void load();
    const t = setInterval(() => void load(), 120_000);
    return () => clearInterval(t);
  }, [profile, load]);

  if (!profile || !st || !st.enabled) return null;

  const ok = st.synced;
  const warn = st.enabled && !st.synced;

  const syncNow = async () => {
    setBusy(true);
    try {
      await hybridAutoSyncAction();
      await load();
    } finally {
      setBusy(false);
    }
  };

  if (compact) {
    return (
      <button
        type="button"
        onClick={() => void syncNow()}
        title={st.syncLabel}
        className={cn(
          "fixed bottom-3 left-3 z-[55] flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-semibold shadow-md backdrop-blur-md",
          ok && "border-emerald-500/40 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
          warn && "border-amber-500/40 bg-amber-500/15 text-amber-800 dark:text-amber-200",
          !ok && !warn && "border-border bg-card/80 text-muted-foreground"
        )}
      >
        {busy ? (
          <RefreshCw className="h-3 w-3 animate-spin" />
        ) : ok ? (
          <CheckCircle2 className="h-3 w-3" />
        ) : (
          <AlertTriangle className="h-3 w-3" />
        )}
        <Sheet className="h-3 w-3 opacity-70" />
        <span className="max-w-[140px] truncate">{ok ? `Sheets · ${st.sheetsCount}` : "Sheets · sync"}</span>
      </button>
    );
  }

  return (
    <div className="rounded-xl border border-border/60 bg-card/50 p-3 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-bold flex items-center gap-1.5">
          {ok ? <CheckCircle2 className="h-4 w-4 text-emerald-500" /> : <CircleDashed className="h-4 w-4 text-amber-500" />}
          Estado da sincronização
        </p>
        <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => void syncNow()}>
          {busy ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
          <span className="ml-1">Sincronizar</span>
        </Button>
      </div>
      <p className="text-[11px] text-muted-foreground">{st.syncLabel}</p>
      <div className="grid grid-cols-2 gap-2 text-[10px]">
        <div className="rounded-lg border p-2">
          <p className="text-muted-foreground">Fonte carteira</p>
          <p className="font-bold">{st.carteiraSource}</p>
        </div>
        <div className="rounded-lg border p-2">
          <p className="text-muted-foreground">Linhas planilha</p>
          <p className="font-bold">{st.sheetsCount ?? "—"}</p>
        </div>
        <div className="rounded-lg border p-2">
          <p className="text-muted-foreground">Webhook</p>
          <p className="font-bold">{st.webhookConfigured ? "OK" : "falta"}</p>
        </div>
        <div className="rounded-lg border p-2">
          <p className="text-muted-foreground">Ping</p>
          <p className="font-bold">{st.ping?.ok ? "pong" : st.ping?.error || "—"}</p>
        </div>
      </div>
    </div>
  );
}

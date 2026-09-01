"use client";

/**
 * Roda hybridAutoSyncAction 1x por sessão (após login).
 * Planilha vazia → seed Supabase→Sheets; senão só confirma pull.
 */

import { useEffect, useRef, useState } from "react";
import { hybridAutoSyncAction, hybridStatusAction } from "@/app/actions/hybrid-sync-actions";
import { useAuth } from "@/components/auth/auth-provider";
import { useToast } from "@/hooks/use-toast";

const SESSION_KEY = "lexis_hybrid_autosync_v1";

export function HybridAutoSync() {
  const { profile, loading } = useAuth();
  const { toast } = useToast();
  const ran = useRef(false);
  const [last, setLast] = useState<string>("");

  useEffect(() => {
    if (loading || ran.current) return;
    if (!profile) return;

    try {
      if (sessionStorage.getItem(SESSION_KEY) === "1") return;
    } catch {
      /* */
    }

    ran.current = true;
    let cancelled = false;

    (async () => {
      try {
        const st = await hybridStatusAction();
        if (!st.enabled || !st.webhookConfigured) return;

        const r = await hybridAutoSyncAction();
        if (cancelled) return;

        try {
          sessionStorage.setItem(SESSION_KEY, "1");
        } catch {
          /* */
        }

        const msg = r.message || r.error || r.action;
        setLast(msg);

        if (r.action === "seed" && r.success) {
          toast({
            title: "Planilha sincronizada",
            description: msg,
          });
        } else if (r.action === "error") {
          toast({
            title: "Sync híbrido",
            description: r.error || msg,
            variant: "destructive",
          });
        }
        // pull silencioso — não enche de toast
      } catch {
        /* */
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [profile, loading, toast]);

  // invisível; opcional debug
  if (process.env.NODE_ENV === "development" && last) {
    return (
      <div className="fixed bottom-16 right-2 z-[60] max-w-xs text-[10px] font-mono opacity-60 pointer-events-none">
        hybrid: {last}
      </div>
    );
  }
  return null;
}

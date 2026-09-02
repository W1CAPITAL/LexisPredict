"use client";

import { useEffect, useRef } from "react";
import { getSupabaseBrowserClient, resetSupabaseBrowserSession } from "@/lib/supabase/browser";

/**
 * Colocar uma única vez no layout autenticado.
 * Não cria outro cliente; usa o singleton. Em caso de refresh 400/stale token,
 * limpa somente a sessão local e deixa o usuário autenticar novamente.
 */
export default function SupabaseSessionRepair() {
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    const client = getSupabaseBrowserClient();
    if (!client) return;

    let disposed = false;
    let lastRecoverAt = 0;

    const recover = async () => {
      if (disposed || Date.now() - lastRecoverAt < 15000) return;
      try {
        const { error } = await client.auth.getSession();
        if (!error) return;
        const msg = String(error.message || "").toLowerCase();
        if (/refresh|invalid|expired|session|token|400/.test(msg)) {
          lastRecoverAt = Date.now();
          await client.auth.signOut({ scope: "local" }).catch(() => undefined);
          resetSupabaseBrowserSession();
        }
      } catch {
        // Auth não pode derrubar o restante do aplicativo.
      }
    };

    const onVisibility = () => {
      if (document.visibilityState === "visible") void recover();
    };

    document.addEventListener("visibilitychange", onVisibility);
    void recover();

    return () => {
      disposed = true;
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  return null;
}

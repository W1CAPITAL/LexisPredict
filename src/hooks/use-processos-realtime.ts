/**
 * Sincronização em tempo real via Supabase Realtime (WebSocket gerenciado).
 * OPCIONAL — só assina se enableRealtime=true e houver empresaId.
 * Não substitui fetchRepoCases; apenas invalida/recarrega.
 */
"use client";

import { useEffect, useRef } from "react";
import { createBrowserClient } from "@supabase/ssr";

type Opts = {
  empresaId?: string | null;
  enabled?: boolean;
  onChange?: () => void;
  /** debounce ms */
  debounceMs?: number;
};

/**
 * Requer Realtime habilitado na tabela `processos` no painel Supabase
 * (Publication supabase_realtime).
 */
export function useProcessosRealtime({
  empresaId,
  enabled = false,
  onChange,
  debounceMs = 1200,
}: Opts) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cb = useRef(onChange);
  cb.current = onChange;

  useEffect(() => {
    if (!enabled || !empresaId) return;
    if (typeof window === "undefined") return;

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) return;

    let supabase: ReturnType<typeof createBrowserClient>;
    try {
      supabase = createBrowserClient(url, key);
    } catch {
      return;
    }

    const schedule = () => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        try {
          cb.current?.();
        } catch {
          //
        }
      }, debounceMs);
    };

    const channel = supabase
      .channel(`processos-emp-${empresaId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "processos",
          filter: `empresa_id=eq.${empresaId}`,
        },
        () => schedule()
      )
      .subscribe();

    return () => {
      if (timer.current) clearTimeout(timer.current);
      try {
        supabase.removeChannel(channel);
      } catch {
        //
      }
    };
  }, [empresaId, enabled, debounceMs]);
}

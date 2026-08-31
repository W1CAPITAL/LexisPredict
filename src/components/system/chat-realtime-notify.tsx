"use client";

/**
 * Escuta INSERT em chat_messages em qualquer página.
 * Dispara notifyChatMessage + toast leve se a aba estiver aberta.
 */

import { useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/components/auth/auth-provider";
import { notifyChatMessage } from "@/components/system/chat-notif-permission";
import { useToast } from "@/hooks/use-toast";

export function ChatRealtimeNotify() {
  const { profile } = useAuth();
  const { toast } = useToast();
  const meRef = useRef<string | null>(null);

  useEffect(() => {
    meRef.current =
      String((profile as any)?.auth_user_id || (profile as any)?.id || "").trim() || null;
  }, [profile]);

  useEffect(() => {
    const onInApp = (ev: Event) => {
      const d = (ev as CustomEvent).detail || {};
      if (document.visibilityState !== "visible") return;
      toast({
        title: String(d.title || "Chat equipe"),
        description: String(d.body || "Nova mensagem"),
      });
    };
    window.addEventListener("lexis-chat-notify", onInApp as any);
    return () => window.removeEventListener("lexis-chat-notify", onInApp as any);
  }, [toast]);

  useEffect(() => {
    let supabase: ReturnType<typeof createClient> | null = null;
    let ch: any = null;
    try {
      supabase = createClient();
      ch = supabase
        .channel("lexis-chat-global")
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "chat_messages" },
          (payload: any) => {
            try {
              const row = payload?.new || {};
              const author = String(row.auth_user_id || row.user_id || "").trim();
              const me = meRef.current;
              if (author && me && author === me) return;
              const body = String(
                row.body || row.texto || row.content || "Nova mensagem no chat equipe"
              );
              notifyChatMessage("Chat equipe", body);
            } catch {
              /* */
            }
          }
        )
        .subscribe();
    } catch {
      /* */
    }
    return () => {
      try {
        if (supabase && ch) void supabase.removeChannel(ch);
      } catch {
        /* */
      }
    };
  }, []);

  return null;
}

"use client";

/**
 * Pedido de notificação do Chat equipe + helpers de notificação.
 */

import React, { useEffect, useState } from "react";
import { Bell, BellOff, MessagesSquare, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const LS_KEY = "lexis_chat_notif";

export function ChatNotifPermission() {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("Notification" in window)) return;

    let pref = "";
    try {
      pref = localStorage.getItem(LS_KEY) || "";
    } catch {
      pref = "";
    }

    if (pref === "granted" && Notification.permission === "granted") return;
    if (pref === "granted") return;

    const t = window.setTimeout(() => setOpen(true), 900);
    return () => window.clearTimeout(t);
  }, []);

  const ativar = async () => {
    setBusy(true);
    try {
      if (!("Notification" in window)) {
        try {
          localStorage.setItem(LS_KEY, "denied");
        } catch { /* */ }
        setOpen(false);
        return;
      }
      const res = await Notification.requestPermission();
      if (res === "granted") {
        try {
          localStorage.setItem(LS_KEY, "granted");
        } catch { /* */ }
        try {
          new Notification("LexisPredict · Chat equipe", {
            body: "Notificações ativadas. Você será avisado de novas mensagens.",
            icon: "/logo.png",
            tag: "lexis-chat-on",
          });
        } catch { /* */ }
      } else {
        try {
          localStorage.setItem(LS_KEY, "dismissed");
        } catch { /* */ }
      }
    } finally {
      setBusy(false);
      setOpen(false);
    }
  };

  const agoraNao = () => setOpen(false);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[180] flex items-end sm:items-center justify-center p-4 bg-black/40 backdrop-blur-[2px]"
      role="dialog"
      aria-labelledby="chat-notif-title"
    >
      <div
        className={cn(
          "w-full max-w-md rounded-2xl border border-border/60 bg-card shadow-2xl",
          "p-5 sm:p-6 animate-in fade-in zoom-in-95 duration-200"
        )}
      >
        <div className="flex items-start gap-3">
          <div className="h-11 w-11 rounded-xl bg-primary/15 text-primary flex items-center justify-center shrink-0">
            <MessagesSquare size={22} />
          </div>
          <div className="min-w-0 flex-1">
            <h2 id="chat-notif-title" className="text-base font-black tracking-tight">
              Notificações do Chat equipe
            </h2>
            <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
              Ative para receber avisos de novas mensagens do chat da equipe em segundo plano.
            </p>
          </div>
          <button type="button" className="text-muted-foreground hover:text-foreground p-1" onClick={agoraNao} aria-label="Fechar">
            <X size={18} />
          </button>
        </div>
        <div className="mt-5 flex flex-col sm:flex-row gap-2">
          <Button className="flex-1 gap-2 h-11 rounded-xl font-bold" onClick={() => void ativar()} disabled={busy}>
            <Bell size={16} />
            {busy ? "Ativando…" : "Ativar notificações"}
          </Button>
          <Button variant="outline" className="flex-1 gap-2 h-11 rounded-xl" onClick={agoraNao} disabled={busy}>
            <BellOff size={16} />
            Agora não
          </Button>
        </div>
        <p className="text-[11px] text-muted-foreground mt-3">
          Depois de ativar, este pedido não aparece mais. Revogue nas configurações do navegador se quiser.
        </p>
      </div>
    </div>
  );
}

/**
 * Dispara notificação do sistema (segundo plano) e evento in-app.
 * Não depende só de visibility — se o browser permitir, notifica sempre
 * (exceto mensagem própria, filtrada no caller).
 */
export function notifyChatMessage(
  title: string,
  body: string,
  opts?: { forceOs?: boolean; silentInApp?: boolean }
) {
  if (typeof window === "undefined") return;

  const text = String(body || "Nova mensagem").slice(0, 160);
  const ttl = title || "Chat equipe";

  // Evento in-app (toast / badge) — sempre que a aba estiver visível
  try {
    if (!opts?.silentInApp) {
      window.dispatchEvent(
        new CustomEvent("lexis-chat-notify", {
          detail: { title: ttl, body: text, at: Date.now() },
        })
      );
    }
  } catch { /* */ }

  try {
    if (!("Notification" in window)) return;
    const pref = localStorage.getItem(LS_KEY);
    if (pref !== "granted") return;
    if (Notification.permission !== "granted") return;

    // OS notification: em background sempre; em foreground só se forceOs
    const hidden = document.visibilityState !== "visible";
    if (!hidden && !opts?.forceOs) return;

    new Notification(ttl, {
      body: text,
      icon: "/logo.png",
      tag: "lexis-chat-msg",
      renotify: true,
    });
  } catch {
    /* */
  }
}

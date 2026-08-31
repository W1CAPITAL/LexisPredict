"use client";

/**
 * Pedido de notificação do Chat equipe.
 * - Se o usuário JÁ ativou (localStorage lexis_chat_notif=granted), não pede de novo.
 * - Se negou ou ainda não decidiu, mostra o modal a cada abertura da sessão
 *   (até ativar).
 */

import React, { useEffect, useState } from "react";
import { Bell, BellOff, MessagesSquare, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const LS_KEY = "lexis_chat_notif"; // granted | denied | "" 

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

    // Já ativou de propósito → nunca mais pedir
    if (pref === "granted" && Notification.permission === "granted") {
      return;
    }

    // Se o browser já está granted mas o user não marcou no app, ainda pode oferecer silencioso
    // Regra do produto: pedir toda abertura ATÉ ativar no app
    if (pref === "granted") return;

    // Mostra após pequeno delay (não bloqueia first paint)
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
        // não grava denied permanente — pede de novo na próxima sessão
        try {
          localStorage.setItem(LS_KEY, "dismissed");
        } catch { /* */ }
      }
    } finally {
      setBusy(false);
      setOpen(false);
    }
  };

  const agoraNao = () => {
    // só fecha nesta sessão; próxima abertura pede de novo
    try {
      sessionStorage.setItem("lexis_chat_notif_session", "1");
    } catch { /* */ }
    setOpen(false);
  };

  useEffect(() => {
    // se já dispensou nesta sessão, não mostra de novo até reload completo ok,
    // mas o user pediu "toda vez que abrir o app" = novo load
    try {
      if (sessionStorage.getItem("lexis_chat_notif_session") === "1") {
        // ainda assim se preferência não é granted, em NOVO load sessionStorage limpa
      }
    } catch { /* */ }
  }, []);

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
              Ative para receber avisos de novas mensagens do chat da equipe, mesmo com a aba em segundo plano.
            </p>
          </div>
          <button
            type="button"
            className="text-muted-foreground hover:text-foreground p-1"
            onClick={agoraNao}
            aria-label="Fechar"
          >
            <X size={18} />
          </button>
        </div>

        <div className="mt-5 flex flex-col sm:flex-row gap-2">
          <Button
            className="flex-1 gap-2 h-11 rounded-xl font-bold"
            onClick={() => void ativar()}
            disabled={busy}
          >
            <Bell size={16} />
            {busy ? "Ativando…" : "Ativar notificações"}
          </Button>
          <Button
            variant="outline"
            className="flex-1 gap-2 h-11 rounded-xl"
            onClick={agoraNao}
            disabled={busy}
          >
            <BellOff size={16} />
            Agora não
          </Button>
        </div>
        <p className="text-[11px] text-muted-foreground mt-3">
          Depois de ativar, este pedido não aparece mais. Você pode revogar a permissão nas configurações do navegador.
        </p>
      </div>
    </div>
  );
}

/** Helper para páginas do chat dispararem notificação se permitido. */
export function notifyChatMessage(title: string, body: string) {
  if (typeof window === "undefined" || !("Notification" in window)) return;
  try {
    if (localStorage.getItem(LS_KEY) !== "granted") return;
    if (Notification.permission !== "granted") return;
    if (document.visibilityState === "visible") return; // só em background
    new Notification(title || "Chat equipe", {
      body: body || "Nova mensagem",
      icon: "/logo.png",
      tag: "lexis-chat-msg",
    });
  } catch {
    /* */
  }
}

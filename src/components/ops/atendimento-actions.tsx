"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Copy, MessageCircle, UserCheck, Check } from "lucide-react";
import { formatWhatsAppLink } from "@/lib/utils";
import { cn } from "@/lib/utils";

/**
 * Fluxo linear: Copiar → WhatsApp (texto) → Marcar contatado
 * Não altera regra de flags — onMarkContacted deve chamar a action existente.
 */
export function AtendimentoActions({
  telefone,
  mensagem,
  onMarkContacted,
  className,
}: {
  telefone?: string | null;
  mensagem: string;
  onMarkContacted?: () => void | Promise<void>;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);
  const [marking, setMarking] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(mensagem || "");
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  };

  const mark = async () => {
    if (!onMarkContacted) return;
    setMarking(true);
    try {
      await onMarkContacted();
    } finally {
      setMarking(false);
    }
  };

  const wa = formatWhatsAppLink(telefone || "", mensagem || undefined);

  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      <Button type="button" variant="secondary" size="sm" onClick={copy} className="h-9 gap-1.5 text-xs">
        {copied ? <Check size={14} /> : <Copy size={14} />}
        {copied ? "Copiado" : "Copiar mensagem"}
      </Button>
      <Button type="button" variant="outline" size="sm" asChild className="h-9 gap-1.5 text-xs">
        <a href={wa} target="_blank" rel="noopener noreferrer">
          <MessageCircle size={14} />
          WhatsApp
        </a>
      </Button>
      {onMarkContacted && (
        <Button
          type="button"
          variant="default"
          size="sm"
          disabled={marking}
          onClick={mark}
          className="h-9 gap-1.5 text-xs"
        >
          <UserCheck size={14} />
          Marcar contatado
        </Button>
      )}
    </div>
  );
}

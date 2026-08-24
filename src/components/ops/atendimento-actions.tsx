"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Copy, MessageCircle, UserCheck, Check, Loader2 } from "lucide-react";
import { formatWhatsAppLink } from "@/lib/utils";
import { cn } from "@/lib/utils";

/**
 * Fluxo linear Lote 3: Copiar → WhatsApp (texto pronto) → Marcar contatado
 * Não limpa flag sozinho — onMarkContacted deve chamar a action existente.
 */
export function AtendimentoActions({
  telefone,
  mensagem,
  onMarkContacted,
  className,
  compact = false,
}: {
  telefone?: string | null;
  mensagem: string;
  onMarkContacted?: () => void | Promise<void>;
  className?: string;
  compact?: boolean;
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
  const h = compact ? "h-8 text-[10px]" : "h-9 text-xs";

  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      <Button type="button" variant="secondary" size="sm" onClick={copy} className={cn(h, "gap-1.5 font-semibold")}>
        {copied ? <Check size={14} /> : <Copy size={14} />}
        {copied ? "Copiado" : "1. Copiar"}
      </Button>
      <Button type="button" variant="outline" size="sm" asChild className={cn(h, "gap-1.5 font-semibold")}>
        <a href={wa} target="_blank" rel="noopener noreferrer">
          <MessageCircle size={14} />
          2. WhatsApp
        </a>
      </Button>
      {onMarkContacted && (
        <Button
          type="button"
          variant="default"
          size="sm"
          disabled={marking}
          onClick={mark}
          className={cn(h, "gap-1.5 font-semibold")}
        >
          {marking ? <Loader2 size={14} className="animate-spin" /> : <UserCheck size={14} />}
          3. Contatado
        </Button>
      )}
    </div>
  );
}

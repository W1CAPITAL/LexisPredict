"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { Globe } from "lucide-react";
import type { LegalCase } from "@/lib/case-logic";
import { cn } from "@/lib/utils";

function stripHtml(s: string): string {
  return s
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Bloco legível de publicação DJEN — Lote 3 */
export function PublicacaoDjenBlock({
  caseData,
  onOpen,
  className,
}: {
  caseData: LegalCase;
  onOpen?: () => void;
  className?: string;
}) {
  const c = caseData as any;
  const raw =
    c.djen_ultimo_resumo ||
    c.evento_resumo ||
    c.djen_texto ||
    "";
  const texto = stripHtml(String(raw)).slice(0, 280);
  const link = c.djen_ultimo_link;
  if (!texto && !link && !c.djen_nova_comunicacao) return null;

  return (
    <div
      className={cn(
        "rounded-lg border border-border bg-background px-2.5 py-2 space-y-1 shadow-sm",
        className
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-[9px] font-semibold text-muted-foreground tracking-wide">
          Publicação (diário oficial)
        </p>
        {(link || onOpen) && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-[10px] font-semibold gap-1"
            onClick={() => {
              if (onOpen) onOpen();
              else if (link) window.open(link, "_blank", "noopener,noreferrer");
            }}
          >
            <Globe size={12} />
            Abrir no D.O.
          </Button>
        )}
      </div>
      {texto ? (
        <p className="text-[11px] text-foreground leading-snug line-clamp-3">{texto}</p>
      ) : (
        <p className="text-[11px] text-muted-foreground">Há publicação recente — abra no D.O. para o teor.</p>
      )}
    </div>
  );
}

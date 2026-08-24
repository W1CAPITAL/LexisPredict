"use client";

import React, { useState } from "react";
import { Copy, Check } from "lucide-react";
import { cn } from "@/lib/utils";

/** CNJ legível, alto contraste, um clique para copiar. */
export function ProtocoloChip({
  protocolo,
  className,
  size = "md",
}: {
  protocolo?: string | null;
  className?: string;
  size?: "sm" | "md" | "lg";
}) {
  const [ok, setOk] = useState(false);
  const p = String(protocolo || "").trim();
  if (!p) return <span className="text-muted-foreground text-xs">—</span>;

  const copy = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(p);
      setOk(true);
      setTimeout(() => setOk(false), 1200);
    } catch {
      /* ignore */
    }
  };

  const sizeCls =
    size === "lg"
      ? "text-sm sm:text-base px-2.5 py-1.5"
      : size === "sm"
        ? "text-[11px] px-1.5 py-0.5"
        : "text-xs sm:text-[13px] px-2 py-1";

  return (
    <button
      type="button"
      onClick={copy}
      title="Copiar número do processo"
      className={cn(
        "inline-flex items-center gap-1.5 max-w-full rounded-md border border-border",
        "bg-card text-foreground font-mono font-semibold tabular-nums tracking-tight",
        "hover:border-primary/50 hover:bg-muted/80 transition-colors shadow-sm",
        sizeCls,
        className
      )}
    >
      <span className="truncate">{p}</span>
      {ok ? <Check className="size-3.5 text-emerald-600 shrink-0" /> : <Copy className="size-3.5 text-muted-foreground shrink-0" />}
    </button>
  );
}

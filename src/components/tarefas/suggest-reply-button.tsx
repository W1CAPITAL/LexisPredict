"use client";

import React from "react";
import { Loader2, Sparkles, MessageSquareText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Botão "Sugerir resposta" com animação de pulso/scan neural.
 */
export function SuggestReplyButton({
  loading,
  onClick,
  label = "Sugerir resposta",
  className,
  disabled,
}: {
  loading?: boolean;
  onClick: () => void;
  label?: string;
  className?: string;
  disabled?: boolean;
}) {
  return (
    <Button
      type="button"
      onClick={onClick}
      disabled={disabled || loading}
      className={cn(
        "relative overflow-hidden h-9 px-3 rounded-xl font-black uppercase text-[9px] tracking-widest gap-1.5",
        "bg-amber-500/15 text-amber-800 border border-amber-500/40 hover:bg-amber-500/25",
        loading && "animate-pulse",
        className
      )}
    >
      {loading && (
        <span className="pointer-events-none absolute inset-0 bg-gradient-to-r from-transparent via-amber-300/30 to-transparent animate-[shimmer_1.2s_infinite]" />
      )}
      {loading ? (
        <Loader2 size={14} className="animate-spin shrink-0" />
      ) : (
        <span className="relative flex items-center gap-1">
          <Sparkles size={14} className="shrink-0 animate-pulse" />
          <MessageSquareText size={14} className="shrink-0" />
        </span>
      )}
      <span className="relative">{loading ? "Gerando…" : label}</span>
      <style jsx>{`
        @keyframes shimmer {
          0% {
            transform: translateX(-100%);
          }
          100% {
            transform: translateX(100%);
          }
        }
      `}</style>
    </Button>
  );
}

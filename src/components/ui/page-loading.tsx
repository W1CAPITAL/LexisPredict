"use client";

import React from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

/** Overlay leve — use enquanto a página carrega dados. */
export function PageLoading({
  label = "Carregando…",
  className,
  full = false,
}: {
  label?: string;
  className?: string;
  full?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 text-muted-foreground",
        full ? "min-h-[50vh] w-full" : "py-12",
        className
      )}
      role="status"
      aria-live="polite"
    >
      <div className="relative h-12 w-12">
        <div className="absolute inset-0 rounded-full border-2 border-primary/20" />
        <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-primary animate-spin" />
        <Loader2 className="absolute inset-0 m-auto h-5 w-5 text-primary/80 animate-pulse" />
      </div>
      <p className="text-sm font-medium animate-pulse">{label}</p>
    </div>
  );
}

export function PageLoadingBar({ active }: { active?: boolean }) {
  if (!active) return null;
  return (
    <div className="fixed top-0 left-0 right-0 z-[200] h-0.5 overflow-hidden bg-transparent pointer-events-none">
      <div className="h-full w-1/3 bg-primary/80 animate-[lexis-loadbar_1.1s_ease-in-out_infinite] rounded-full" />
      <style jsx global>{`
        @keyframes lexis-loadbar {
          0% { transform: translateX(-120%); }
          100% { transform: translateX(320%); }
        }
      `}</style>
    </div>
  );
}

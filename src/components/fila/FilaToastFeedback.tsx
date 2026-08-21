"use client";

import { useEffect } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export type FilaFeedback =
  | { type: "idle" }
  | { type: "saving"; label?: string }
  | { type: "ok"; label?: string }
  | { type: "error"; label?: string };

/** Toast fixo no rodapé — feedback imediato no web e mobile. */
export function FilaToastFeedback({
  state,
  onDismiss,
  className,
}: {
  state: FilaFeedback;
  onDismiss?: () => void;
  className?: string;
}) {
  useEffect(() => {
    if (state.type !== "ok" && state.type !== "error") return;
    const t = setTimeout(() => onDismiss?.(), 2500);
    return () => clearTimeout(t);
  }, [state, onDismiss]);

  if (state.type === "idle") return null;

  const styles =
    state.type === "ok"
      ? "bg-emerald-600 text-white"
      : state.type === "error"
        ? "bg-red-600 text-white"
        : "bg-black text-white";

  return (
    <div
      className={cn(
        "fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] flex items-center gap-2 px-4 py-3 rounded-2xl shadow-2xl text-[11px] font-black uppercase tracking-wider animate-in slide-in-from-bottom-4",
        styles,
        className
      )}
      role="status"
      aria-live="polite"
    >
      {state.type === "saving" && <Loader2 size={16} className="animate-spin" />}
      {state.type === "ok" && <CheckCircle2 size={16} />}
      <span>
        {state.label ||
          (state.type === "saving"
            ? "Salvando…"
            : state.type === "ok"
              ? "Registrado"
              : "Falha ao salvar")}
      </span>
    </div>
  );
}

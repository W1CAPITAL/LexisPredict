"use client";

import { cn } from "@/lib/utils";
import type { CarteiraScopeMode } from "@/lib/carteira-scope";

type Props = {
  value: CarteiraScopeMode;
  onChange: (m: CarteiraScopeMode) => void;
  allowCompany?: boolean;
  className?: string;
};

const LABELS: Record<CarteiraScopeMode, string> = {
  mine: "Meus",
  priority: "Prioridade",
  company: "Empresa",
};

/** Admin não carrega a empresa inteira por padrão — "Empresa" é opt-in. */
export function CarteiraScopeToggle({ value, onChange, allowCompany, className }: Props) {
  const modes: CarteiraScopeMode[] = allowCompany
    ? ["mine", "priority", "company"]
    : ["mine", "priority"];

  return (
    <div
      className={cn("inline-flex rounded-full border border-border/60 bg-secondary/30 p-0.5", className)}
      role="group"
      aria-label="Escopo da carteira"
    >
      {modes.map((m) => (
        <button
          key={m}
          type="button"
          onClick={() => onChange(m)}
          className={cn(
            "h-8 px-3 rounded-full text-[9px] font-black uppercase tracking-wider transition",
            value === m ? "bg-black text-white shadow" : "text-muted-foreground hover:text-foreground"
          )}
        >
          {LABELS[m]}
        </button>
      ))}
    </div>
  );
}

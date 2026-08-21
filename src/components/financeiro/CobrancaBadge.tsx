"use client";

import { cn } from "@/lib/utils";
import { statusCobrancaCliente, type TituloResumo } from "@/lib/cobranca-status-fila";

export function CobrancaBadge({
  titulos,
  className,
}: {
  titulos: TituloResumo[];
  className?: string;
}) {
  const s = statusCobrancaCliente(titulos);
  if (s.status === "sem_titulo") return null;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 h-6 px-2 rounded-full text-[9px] font-black uppercase tracking-wider",
        s.className,
        className
      )}
      title={s.valorAberto ? `Aberto: ${s.valorAberto.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}` : undefined}
    >
      {s.label}
    </span>
  );
}

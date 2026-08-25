"use client";

import { getOperacaoSistemaLabel } from "@/lib/operacao-sistema";

/** Subtítulo sutil: operação W1 CONTROL / Davi — não é atendimento de operador. */
export function W1ControlBadge({ caseData }: { caseData: any }) {
  const legenda = getOperacaoSistemaLabel(caseData);
  if (!legenda) return null;
  return (
    <p
      className="text-[10px] leading-tight text-muted-foreground/80 mt-0.5"
      title="Operação de sistema — não entra no ranking de atendimentos"
    >
      <span className="font-semibold tracking-wide uppercase text-[9px] opacity-90">W1 Control</span>
      <span className="mx-1 opacity-50">·</span>
      <span>{legenda}</span>
    </p>
  );
}

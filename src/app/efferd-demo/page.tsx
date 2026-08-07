"use client";

import { EfferdDashboard2 } from "@/components/ui/efferd-dashboard-2";

/** Demo do shell Efferd adaptado ao Lexis (não substitui o Painel operacional). */
export default function EfferdDemoPage() {
  return (
    <EfferdDashboard2
      totalProcessos={1200}
      pendentes={244}
      vencidos={18}
      novidades={51}
    />
  );
}

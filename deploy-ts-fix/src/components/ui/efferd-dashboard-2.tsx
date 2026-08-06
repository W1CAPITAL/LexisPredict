"use client";

/**
 * Efferd-style dashboard shell adaptado ao LexisPredict.
 * Usa AppShell (sidebar Lexis) + Dashboard (métricas + recharts).
 */
import { AppShell } from "@/components/app-shell";
import { Dashboard } from "@/components/dashboard/efferd-dashboard-panel";

export function EfferdDashboard2(props: {
  totalProcessos?: number;
  pendentes?: number;
  vencidos?: number;
  novidades?: number;
  ativos?: number;
  baixas?: number;
  hoje?: number;
  riskScore?: number;
  compact?: boolean;
  className?: string;
}) {
  return (
    <AppShell>
      <Dashboard
        totalProcessos={props.totalProcessos ?? 0}
        pendentes={props.pendentes ?? 0}
        vencidos={props.vencidos ?? 0}
        novidades={props.novidades ?? 0}
        ativos={props.ativos}
        baixas={props.baixas}
        hoje={props.hoje}
        riskScore={props.riskScore}
        compact={props.compact}
        className={props.className}
      />
    </AppShell>
  );
}

export default EfferdDashboard2;

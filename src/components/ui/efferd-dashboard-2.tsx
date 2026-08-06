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
}) {
  return (
    <AppShell>
      <Dashboard {...props} />
    </AppShell>
  );
}

export default EfferdDashboard2;

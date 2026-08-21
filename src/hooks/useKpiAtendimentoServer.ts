"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchKpiAtendimentoEmpresaAction } from "@/app/actions/kpi-atendimento-actions";
import type { KpiAtendimentoServer } from "@/lib/kpi-atendimento-server";

/** KPIs de atendimento da empresa completa (independente da lista limitada). */
export function useKpiAtendimentoServer(enabled = true) {
  const [kpi, setKpi] = useState<KpiAtendimentoServer | null>(null);
  const [loading, setLoading] = useState(false);

  const reload = useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    try {
      const data = await fetchKpiAtendimentoEmpresaAction();
      setKpi(data);
    } catch {
      /* keep previous */
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { kpi, loading, reload };
}

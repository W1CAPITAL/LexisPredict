"use client";

import { useCallback, useEffect, useState } from "react";
import {
  fetchKpiAtendimentoEmpresaAction,
  type KpiAtendimentoServer,
} from "@/app/actions/kpi-atendimento-actions";

export function useKpiAtendimentoServer(enabled = true) {
  const [kpi, setKpi] = useState<KpiAtendimentoServer | null>(null);
  const [loading, setLoading] = useState(false);

  const reload = useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    try {
      setKpi(await fetchKpiAtendimentoEmpresaAction());
    } catch {
      /* */
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { kpi, loading, reload };
}

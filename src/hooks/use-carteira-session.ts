"use client";

/**
 * Hook: lista rápida via session cache + KPI só com rede.
 */
import { useCallback, useRef, useState } from "react";
import { fetchRepoCases } from "@/app/actions/case-actions";
import {
  loadCarteiraComCache,
  invalidateCarteiraCache,
  writeCarteiraCache,
  type CacheSource,
} from "@/lib/session-carteira-cache";
import type { LegalCase } from "@/lib/case-logic";

export function useCarteiraSession(empresaId?: string | null) {
  const [cases, setCasesState] = useState<LegalCase[]>([]);
  const [source, setSource] = useState<CacheSource>("empty");
  const [loading, setLoading] = useState(false);
  const kpiCasesRef = useRef<LegalCase[]>([]);
  const [kpiReady, setKpiReady] = useState(false);

  const setCases = useCallback((list: LegalCase[]) => {
    setCasesState(list);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      await loadCarteiraComCache({
        empresaId,
        fetchNetwork: async () => (await fetchRepoCases()) || [],
        onShow: (list, src) => {
          setCasesState(list as LegalCase[]);
          setSource(src);
        },
        onKpiSafe: (list) => {
          kpiCasesRef.current = list as LegalCase[];
          setKpiReady(true);
        },
        allowStaleKpiFallback: false,
      });
    } finally {
      setLoading(false);
    }
  }, [empresaId]);

  /** Após mutação: atualiza UI + cache com o array final (já da rede ou otimista). */
  const commitCases = useCallback(
    (list: LegalCase[]) => {
      setCasesState(list);
      writeCarteiraCache(list, empresaId);
      kpiCasesRef.current = list;
      setSource("network");
      setKpiReady(true);
    },
    [empresaId]
  );

  const invalidate = useCallback(() => {
    invalidateCarteiraCache();
    setKpiReady(false);
  }, []);

  return {
    cases,
    setCases,
    /** Use em Top Atendentes / cards de KPI — evita número de cache velho */
    casesForKpi: kpiReady ? kpiCasesRef.current : cases,
    kpiReady,
    source,
    loading,
    load,
    commitCases,
    invalidate,
  };
}

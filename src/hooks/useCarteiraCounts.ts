"use client";

import { useCallback, useEffect, useState } from "react";
import {
  fetchCarteiraCountsAction,
  type CarteiraCounts,
} from "@/app/actions/carteira-counts-actions";

export function useCarteiraCounts(enabled = true) {
  const [counts, setCounts] = useState<CarteiraCounts | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    try {
      const result = await fetchCarteiraCountsAction();
      if (result.ok) {
        setCounts(result);
        setError(null);
      } else {
        // Keep no false zero on a transport/database/permission failure.
        setCounts(null);
        setError(result.error || "Indicadores indisponíveis.");
      }
    } catch {
      setCounts(null);
      setError("Falha na consulta dos indicadores.");
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { counts, loading, error, reload };
}

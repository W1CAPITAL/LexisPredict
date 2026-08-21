"use client";

import { useCallback, useEffect, useState } from "react";
import {
  fetchCarteiraCountsAction,
  type CarteiraCounts,
} from "@/app/actions/carteira-counts-actions";

export function useCarteiraCounts(enabled = true) {
  const [counts, setCounts] = useState<CarteiraCounts | null>(null);
  const [loading, setLoading] = useState(false);

  const reload = useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    try {
      setCounts(await fetchCarteiraCountsAction());
    } catch {
      /* */
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { counts, loading, reload };
}

"use client";

import { useEffect, useState } from "react";

/** Valor atrasado — input continua fluido; filtro só roda após `ms`. */
export function useDebouncedValue<T>(value: T, ms = 280): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(value), ms);
    return () => window.clearTimeout(t);
  }, [value, ms]);
  return debounced;
}

/** Persiste filtros de lista na sessão (trocar de aba não zera). */
export function loadFilterState<T extends Record<string, unknown>>(
  key: string,
  fallback: T
): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = sessionStorage.getItem(`lexis_filter_${key}`);
    if (!raw) return fallback;
    return { ...fallback, ...JSON.parse(raw) };
  } catch {
    return fallback;
  }
}

export function saveFilterState(key: string, state: Record<string, unknown>) {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(`lexis_filter_${key}`, JSON.stringify(state));
  } catch {
    /* */
  }
}

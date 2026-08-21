"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

const STORAGE_KEY = "lexis_tarefas_filters_v1";

export type FilaFiltersState = {
  filaFiltro: string;
  search: string;
  officeFilter: string;
  lawyerFilter: string;
  somenteMeta: boolean;
  focusMode: boolean;
};

const DEFAULTS: FilaFiltersState = {
  filaFiltro: "all",
  search: "",
  officeFilter: "",
  lawyerFilter: "",
  somenteMeta: true,
  focusMode: false,
};

function readStorage(): Partial<FilaFiltersState> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as Partial<FilaFiltersState>;
  } catch {
    return {};
  }
}

/**
 * Sincroniza filtros: URL (compartilhável) ↔ localStorage ↔ state.
 * Web first-class: link com ?fila=replica&meta=0 funciona.
 */
export function useFilaFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [state, setState] = useState<FilaFiltersState>(DEFAULTS);
  const [hydrated, setHydrated] = useState(false);

  // Hidratação: URL ganha de localStorage
  useEffect(() => {
    const fromUrl: Partial<FilaFiltersState> = {};
    const f = searchParams.get("fila");
    if (f) fromUrl.filaFiltro = f;
    const q = searchParams.get("q");
    if (q) fromUrl.search = q;
    const meta = searchParams.get("meta");
    if (meta === "0") fromUrl.somenteMeta = false;
    if (meta === "1") fromUrl.somenteMeta = true;
    const focus = searchParams.get("focus");
    if (focus === "1") fromUrl.focusMode = true;

    const stored = readStorage();
    setState({ ...DEFAULTS, ...stored, ...fromUrl });
    setHydrated(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const persist = useCallback(
    (next: FilaFiltersState) => {
      setState(next);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        /* */
      }
      const params = new URLSearchParams();
      if (next.filaFiltro && next.filaFiltro !== "all") params.set("fila", next.filaFiltro);
      if (next.search) params.set("q", next.search);
      if (!next.somenteMeta) params.set("meta", "0");
      if (next.focusMode) params.set("focus", "1");
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [pathname, router]
  );

  const patch = useCallback(
    (partial: Partial<FilaFiltersState>) => {
      persist({ ...state, ...partial });
    },
    [persist, state]
  );

  const clear = useCallback(() => {
    persist({ ...DEFAULTS, somenteMeta: false });
  }, [persist]);

  return { state, patch, clear, hydrated, setState: persist };
}

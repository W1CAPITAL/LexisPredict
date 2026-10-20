"use client";

import { useEffect, useState } from "react";
import type { LegalCase } from "@/lib/case-logic";
import { searchCompanyProcessosAction } from "@/app/actions/search-processos-action";

type SearchResult = { term: string; cases: LegalCase[]; error: string };
const EMPTY_CASES: LegalCase[] = [];

/** Pesquisa o banco inteiro da empresa, nunca somente a pagina em cache. */
export function useCompanyProcessSearch(value: string, enabled = true, refreshKey = 0) {
  const term = value.trim();
  const active = enabled && term.length >= 2;
  const [result, setResult] = useState<SearchResult | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!active) {
      setResult(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setResult(null);
    void searchCompanyProcessosAction(term)
      .then((response) => {
        if (!cancelled) setResult({
          term,
          cases: response.ok ? response.cases as LegalCase[] : [],
          error: response.ok ? "" : (response.error || "Falha ao consultar a carteira."),
        });
      })
      .catch(() => {
        if (!cancelled) setResult({ term, cases: [], error: "Falha ao consultar a carteira." });
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [term, active, refreshKey]);

  const current = active && result?.term === term ? result : null;
  return {
    active,
    cases: current?.cases || EMPTY_CASES,
    searching: active && (loading || !current),
    error: current?.error || "",
  };
}

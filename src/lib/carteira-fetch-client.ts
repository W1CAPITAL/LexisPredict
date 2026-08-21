/**
 * Uma única ida à rede para a carteira por janela de tempo.
 * Evita /dashboard + /tarefas + /processos + /cases cada um puxar 100% do Postgres.
 */
"use client";

import type { LegalCase } from "@/lib/case-logic";

type CacheBox = {
  at: number;
  empresaKey: string;
  cases: LegalCase[];
};

const TTL_MS = 90_000; // 90s — troca de aba não refaz egress
let box: CacheBox | null = null;
let inflight: Promise<LegalCase[]> | null = null;
let inflightKey = "";

export function peekCarteiraClientCache(): LegalCase[] | null {
  if (!box) return null;
  if (Date.now() - box.at > TTL_MS) return null;
  return box.cases;
}

export function seedCarteiraClientCache(cases: LegalCase[], empresaKey = "default") {
  box = { at: Date.now(), empresaKey, cases: Array.isArray(cases) ? cases : [] };
}

export function invalidateCarteiraClientCache() {
  box = null;
  inflight = null;
  inflightKey = "";
}

/**
 * Deduplica fetchRepoCases entre abas montadas ao mesmo tempo.
 */
export async function fetchCarteiraDeduped(
  fetchFn: () => Promise<LegalCase[] | null | undefined>,
  opts?: { force?: boolean; empresaKey?: string }
): Promise<LegalCase[]> {
  const key = opts?.empresaKey || "default";
  if (!opts?.force && box && box.empresaKey === key && Date.now() - box.at < TTL_MS) {
    return box.cases;
  }
  if (inflight && inflightKey === key) {
    return inflight;
  }
  inflightKey = key;
  inflight = (async () => {
    try {
      const raw = (await fetchFn()) || [];
      const cases = Array.isArray(raw) ? raw : [];
      // Não cacheia lista vazia (evita "NENHUM CASO" permanente após falha transitória)
      if (cases.length > 0) {
        box = { at: Date.now(), empresaKey: key, cases };
      }
      return cases;
    } finally {
      inflight = null;
      inflightKey = "";
    }
  })();
  return inflight;
}

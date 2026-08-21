/**
 * Helpers client para Fila e Dashboard.
 * Troca fetchRepoCases() sem args por purpose + scope.
 */

"use client";

import { fetchCarteiraDeduped, invalidateCarteiraClientCache } from "@/lib/carteira-fetch-client";
import type { CarteiraScopeMode } from "@/lib/carteira-scope";

export type LoadCarteiraUiOpts = {
  purpose: "dashboard" | "tarefas";
  scope?: CarteiraScopeMode;
  force?: boolean;
  empresaKey?: string;
  /** injete a server action já atualizada */
  fetchFn: (opts?: { purpose?: string; scope?: CarteiraScopeMode; limit?: number }) => Promise<any[]>;
};

/**
 * Uso na page:
 *
 * const data = await loadCarteiraForUi({
 *   purpose: "tarefas",
 *   scope: wide ? "company" : "priority",
 *   empresaKey: empId,
 *   fetchFn: (o) => fetchRepoCases(o as any),
 * });
 */
export async function loadCarteiraForUi(opts: LoadCarteiraUiOpts) {
  const key = `${opts.empresaKey || "default"}:${opts.purpose}:${opts.scope || "priority"}`;
  return fetchCarteiraDeduped(
    () =>
      opts.fetchFn({
        purpose: opts.purpose,
        scope: opts.scope,
      }) as Promise<any[]>,
    { force: opts.force, empresaKey: key }
  );
}

export function bustCarteiraCaches() {
  invalidateCarteiraClientCache();
  try {
    const { invalidateCarteiraCache } = require("@/lib/session-carteira-cache");
    invalidateCarteiraCache?.();
  } catch {
    /* */
  }
}

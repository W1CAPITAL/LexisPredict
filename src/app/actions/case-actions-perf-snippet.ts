/**
 * SNIPPET para colar em case-actions.ts (substituir fetchRepoCases).
 *
 * Antes: wide=true para Administrador → até 2000 × select('*') em páginas de 500.
 * Depois: scope priority (400 cols leves) por padrão; company só se pedido.
 */

"use server";

/*
import { getUserContext, getSupabaseAdmin, supabase, toLegalCase } from "@/lib/server-db";
import { getStoredCasesFast } from "@/lib/get-stored-cases-fast";
import { defaultScopeForCargo, type CarteiraScopeMode } from "@/lib/carteira-scope";
import { CARTEIRA_LIMITS } from "@/lib/carteira-scope";

export async function fetchRepoCases(opts?: {
  scope?: CarteiraScopeMode;
  limit?: number;
  purpose?: "dashboard" | "tarefas" | "full";
}) {
  const ctx = await getUserContext();
  if (!ctx.empresa_id) return [];

  const mode =
    opts?.scope ||
    defaultScopeForCargo({
      isSuperAdmin: ctx.isSuperAdmin,
      isSupervisor: ctx.isSupervisor,
      isAdmin: !!(ctx as any).isAdministrador || ctx.isMasterView,
    });

  const limit =
    opts?.limit ??
    (opts?.purpose === "dashboard"
      ? CARTEIRA_LIMITS.dashboard
      : opts?.purpose === "full"
        ? CARTEIRA_LIMITS.hardMax
        : CARTEIRA_LIMITS.tarefas);

  const useAdminClient = mode === "company" || mode === "priority";
  let client = useAdminClient ? await getSupabaseAdmin() : supabase;
  if (!client) client = supabase;
  if (!client) return [];

  return getStoredCasesFast({
    empresaId: ctx.empresa_id,
    authId: ctx.auth_id,
    mode: mode === "company" ? "company" : mode === "priority" ? "priority" : "mine",
    limit,
    client,
    toLegalCase,
  });
}

export async function fetchRepoCasesPageAction(
  limit = 250,
  offset = 0,
  adminView = false
) {
  // manter implementação paginada existente, mas com PROCESSOS_LIST_COLUMNS
}
*/

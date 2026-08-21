/**
 * Escopo da carteira por cargo.
 *
 * Problema atual: Administrador / Supervisor / Superadmin sempre puxam a
 * empresa INTEIRA (até 2000 × select('*')) no Dashboard e na Fila.
 *
 * Regra nova:
 * - Operador: só meus (+ órfãos se vazio)
 * - Admin/Supervisor: por padrão "prioridade" (lote limitado), opcional "empresa"
 * - Superadmin: igual admin, mas pode forçar wide
 */

export type CarteiraScopeMode = "mine" | "priority" | "company";

export type CarteiraFetchOpts = {
  /** mine | priority (default admin) | company (wide) */
  mode?: CarteiraScopeMode;
  /** teto de linhas (default 400 priority, 800 company) */
  limit?: number;
  /** incluir coluna dados (pesado) — só detalhe */
  includeDados?: boolean;
};

export const CARTEIRA_LIMITS = {
  /** Dashboard: KPIs + amostra crítica */
  dashboard: 350,
  /** Fila de atendimento */
  tarefas: 400,
  /** Visão empresa / supervisão (paginada no cliente) */
  companyPage: 250,
  /** Teto absoluto anti-timeout */
  hardMax: 1200,
} as const;

export function defaultScopeForCargo(opts: {
  isSuperAdmin?: boolean;
  isSupervisor?: boolean;
  isAdmin?: boolean;
  /** query ?scope=company */
  forced?: CarteiraScopeMode | null;
}): CarteiraScopeMode {
  if (opts.forced) return opts.forced;
  // Admin não precisa da carteira inteira só para abrir a Fila
  if (opts.isSuperAdmin || opts.isSupervisor || opts.isAdmin) return "priority";
  return "mine";
}

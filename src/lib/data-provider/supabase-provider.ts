/**
 * SupabaseProvider — adaptador fino.
 * Mantém compatibilidade: o app atual continua usando server-db/actions.
 * Este provider existe para a abstração unificada (kind === "supabase").
 *
 * Não duplica toda a lógica Supabase aqui — delega ao fluxo legado
 * via window marker / no-op list até migração gradual das pages.
 */

import type { DataProvider, SessionUser } from "./types";

const SESSION_KEY = "lexis_supabase_session_marker";

export function createSupabaseProvider(): DataProvider {
  return {
    kind: "supabase",
    auth: {
      async login() {
        return {
          ok: false,
          error: "Login Supabase permanece no fluxo atual (auth provider). Use kind=supabase no app legado.",
        };
      },
      async logout() {
        if (typeof window !== "undefined") localStorage.removeItem(SESSION_KEY);
      },
      currentUser(): SessionUser | null {
        return null;
      },
    },
    processes: {
      async list() {
        return [];
      },
      async upsert(row) {
        return row;
      },
      async remove() {},
    },
    leads: {
      async list() {
        return [];
      },
      async upsert(row) {
        return row;
      },
    },
    clients: {
      async list() {
        return [];
      },
      async upsert(row) {
        return row;
      },
    },
    sync: {
      async ping() {
        return { ok: true };
      },
      async pull() {
        return { ok: true, processes: [], leads: [] };
      },
      async push() {
        return { ok: true, applied: 0 };
      },
    },
  };
}

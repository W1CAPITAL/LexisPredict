"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let singleton: SupabaseClient | null = null;

const SESSION_KEYS = [
  "supabase.auth.token",
  "sb-auth-token",
  "sb-session",
];

function getEnv(name: string): string {
  return (process.env[name] || "").trim();
}

function purgeLegacySupabaseStorage() {
  if (typeof window === "undefined") return;
  try {
    for (const storage of [window.localStorage, window.sessionStorage]) {
      for (let i = storage.length - 1; i >= 0; i -= 1) {
        const key = storage.key(i);
        if (!key) continue;
        const lower = key.toLowerCase();
        if (
          SESSION_KEYS.includes(key) ||
          lower.includes("supabase.auth") ||
          lower.includes("sb-")
        ) {
          storage.removeItem(key);
        }
      }
    }
  } catch {
    // Storage pode estar bloqueado pelo navegador.
  }
}

export function resetSupabaseBrowserSession() {
  purgeLegacySupabaseStorage();
  if (typeof window !== "undefined") {
    try {
      const keys = Object.keys(window.localStorage);
      for (const key of keys) {
        if (/^sb-[^-]+-auth-token/i.test(key) || /supabase/i.test(key)) {
          window.localStorage.removeItem(key);
        }
      }
    } catch {
      // noop
    }
  }
}

export function getSupabaseBrowserClient(): SupabaseClient | null {
  if (typeof window === "undefined") return null;
  if (singleton) return singleton;

  const url = getEnv("NEXT_PUBLIC_SUPABASE_URL");
  const key = getEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  if (!url || !key) return null;

  singleton = createClient(url, key, {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
      flowType: "pkce",
    },
    realtime: {
      params: { eventsPerSecond: 1 },
    },
  });

  let recovering = false;
  singleton.auth.onAuthStateChange((event, session) => {
    if (event === "TOKEN_REFRESHED" || event === "SIGNED_IN") return;
    if (event === "SIGNED_OUT" || (!session && event === "USER_UPDATED")) return;

    // Evita tempestade de refresh quando o navegador recupera de uma sessão ruim.
    if (event === ("USER_DELETED" as any) && !recovering) {
      recovering = true;
      resetSupabaseBrowserSession();
      window.setTimeout(() => {
        recovering = false;
      }, 1000);
    }
  });

  return singleton;
}

export async function ensureSupabaseBrowserSession(): Promise<{
  ok: boolean;
  user: Awaited<ReturnType<SupabaseClient["auth"]["getUser"]>>["data"]["user"] | null;
}> {
  const client = getSupabaseBrowserClient();
  if (!client) return { ok: false, user: null };

  const current = await client.auth.getSession();
  if (current.error) {
    resetSupabaseBrowserSession();
    return { ok: false, user: null };
  }

  if (!current.data.session) return { ok: false, user: null };

  const user = await client.auth.getUser();
  if (!user.error && user.data.user) return { ok: true, user: user.data.user };

  // Refresh token inválido/stale: apaga apenas a sessão local quebrada.
  const msg = String(user.error?.message || "").toLowerCase();
  if (/refresh|token|session|unauthorized|invalid/i.test(msg)) {
    try {
      await client.auth.signOut({ scope: "local" });
    } catch {
      // A limpeza local abaixo é o fallback.
    }
    resetSupabaseBrowserSession();
  }

  return { ok: false, user: null };
}

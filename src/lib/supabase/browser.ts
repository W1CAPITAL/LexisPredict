import { createBrowserClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';

let singleton: SupabaseClient | null = null;

/** All browser entry points share the cookie-backed SSR client. */
export function getSupabaseBrowserClient(): SupabaseClient | null {
  if (typeof window === 'undefined') return null;
  if (singleton) return singleton;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!url || !key) return null;
  singleton = createBrowserClient(url, key);
  return singleton;
}

/** Only after a confirmed invalid session or an explicit local logout. */
export function resetSupabaseBrowserSession() {
  if (typeof window === 'undefined') return;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const project = url ? new URL(url).hostname.split('.')[0] : '';
  const key = project ? `sb-${project}-auth-token` : '';
  try {
    for (const storage of [window.localStorage, window.sessionStorage]) {
      for (const legacy of ['lexis-auth', 'supabase.auth.token', key]) {
        if (legacy) storage.removeItem(legacy);
      }
    }
  } catch { /* Storage may be unavailable in private browsing. */ }
  if (key) {
    for (const cookie of document.cookie.split(';')) {
      const name = cookie.trim().split('=')[0];
      if (name === key || name.startsWith(`${key}.`)) {
        document.cookie = `${name}=; path=/; max-age=0; samesite=lax`;
      }
    }
  }
}

export async function ensureSupabaseBrowserSession() {
  const client = getSupabaseBrowserClient();
  if (!client) return { ok: false, user: null };
  const { data, error } = await client.auth.getUser();
  if (!error && data.user) return { ok: true, user: data.user };
  if (error && (error.status === 401 || error.status === 403)) {
    await client.auth.signOut({ scope: 'local' }).catch(() => undefined);
    resetSupabaseBrowserSession();
  }
  return { ok: false, user: null };
}

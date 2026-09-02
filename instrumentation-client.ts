/*
 * LexisPredict browser auth recovery.
 * Next.js loads this file on the client before the application bootstraps.
 * It only reacts to a confirmed Supabase refresh-token 400.
 */

const COOLDOWN_KEY = "lexis_supabase_refresh_reset_at";

function clearSupabaseBrowserSession() {
  try {
    for (const storage of [window.localStorage, window.sessionStorage]) {
      for (const key of Object.keys(storage)) {
        if (/^sb-[^-]+-auth-token(?:\.|$)/i.test(key) || /supabase\.auth/i.test(key)) {
          storage.removeItem(key);
        }
      }
    }

    for (const item of document.cookie.split(";")) {
      const name = item.split("=")[0]?.trim() || "";
      if (/^sb-[^-]+-auth-token(?:\.|$)/i.test(name) || /supabase/i.test(name)) {
        document.cookie = `${name}=; Max-Age=0; path=/; SameSite=Lax`;
      }
    }
  } catch {
    // Authentication recovery must never break the application itself.
  }
}

if (typeof window !== "undefined" && !(window as any).__lexisRefreshGuardInstalled) {
  (window as any).__lexisRefreshGuardInstalled = true;
  const nativeFetch = window.fetch.bind(window);

  window.fetch = async (...args: Parameters<typeof fetch>) => {
    const response = await nativeFetch(...args);

    try {
      const request = args[0];
      const url =
        typeof request === "string"
          ? request
          : request instanceof Request
            ? request.url
            : String((request as any)?.url || "");

      if (
        response.status === 400 &&
        /\/auth\/v1\/token(?:\?|$)/i.test(url) &&
        /grant_type=refresh_token/i.test(url)
      ) {
        const now = Date.now();
        const last = Number(sessionStorage.getItem(COOLDOWN_KEY) || 0);
        if (!last || now - last > 30_000) {
          sessionStorage.setItem(COOLDOWN_KEY, String(now));
          clearSupabaseBrowserSession();
          window.dispatchEvent(new CustomEvent("lexis:supabase-refresh-invalid"));
        }
      }
    } catch {
      // Do not change the behavior of unrelated requests.
    }

    return response;
  };

  window.addEventListener("lexis:supabase-refresh-invalid", () => {
    try {
      const path = window.location.pathname || "/";
      if (!/^\/login(?:\/|$)/i.test(path)) {
        window.location.replace("/login?reason=session-expired");
      }
    } catch {
      // noop
    }
  });
}

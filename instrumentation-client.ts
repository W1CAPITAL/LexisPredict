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

/*
 * Inbox de autoaprimoramento: guarda erros de runtime da sessão no
 * sessionStorage (cap 50). O painel /autoaprimoramento exporta isso como
 * JSON para o ciclo local do Ornith analisar. Nunca envia nada pela rede.
 */
if (typeof window !== "undefined" && !(window as any).__lexisSelfImproveInboxInstalled) {
  (window as any).__lexisSelfImproveInboxInstalled = true;
  const INBOX_KEY = "lexis_selfimprove_inbox";

  const pushInbox = (evento: { tipo: string; rota: string; mensagem: string }) => {
    try {
      const raw = sessionStorage.getItem(INBOX_KEY);
      const lista: Array<any> = raw ? JSON.parse(raw) : [];
      const msg = String(evento.mensagem || "").slice(0, 400);
      const igual = lista.find((e) => e.tipo === evento.tipo && e.mensagem === msg);
      if (igual) {
        igual.count = (igual.count || 1) + 1;
        igual.quando = new Date().toISOString();
      } else {
        lista.push({
          tipo: evento.tipo,
          rota: String(evento.rota || "/").split("?")[0],
          mensagem: msg,
          quando: new Date().toISOString(),
          count: 1,
        });
      }
      sessionStorage.setItem(INBOX_KEY, JSON.stringify(lista.slice(-50)));
    } catch {
      // A inbox nunca pode quebrar o app.
    }
  };

  window.addEventListener("error", (ev) => {
    pushInbox({
      tipo: "erro",
      rota: window.location.pathname || "/",
      mensagem: String(ev?.message || ev?.error || "erro desconhecido"),
    });
  });
  window.addEventListener("unhandledrejection", (ev) => {
    const motivo: any = (ev as PromiseRejectionEvent)?.reason;
    pushInbox({
      tipo: "promise",
      rota: window.location.pathname || "/",
      mensagem: String(motivo?.message || motivo || "rejeição não tratada"),
    });
  });
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

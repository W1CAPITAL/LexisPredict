"use server";

import {
  sherlockConfigured,
  sherlockApiUrl,
  sherlockEnabledFlag,
  sherlockIsLocalhostUrl,
  sherlockLookupNome,
  sherlockLookupUsername,
  usernamesFromNome,
} from "@/lib/sherlock-client";

export async function sherlockStatusAction() {
  const url = sherlockApiUrl();
  const enabled = sherlockEnabledFlag();
  const ready = sherlockConfigured();
  const localhost = url ? sherlockIsLocalhostUrl(url) : false;
  return {
    optional: true as const,
    enabled,
    urlSet: !!url,
    ready,
    urlPreview: url ? (localhost ? "http://127.0.0.1:…" : url.replace(/https?:\/\//, "").slice(0, 40)) : "",
    localhost,
    hint: !enabled
      ? "Sherlock opcional e desligado."
      : !url
        ? "SHERLOCK_ENABLED=true, mas falta SHERLOCK_API_URL."
        : localhost
          ? "URL é 127.0.0.1 — no Vercel Production isso NÃO alcança o seu PC. Use npm run dev na sua máquina com a API local, ou uma URL pública."
          : "Sherlock pronto.",
  };
}

export async function sherlockBuscarPorNomeAction(nome: string) {
  return sherlockLookupNome(String(nome || "").trim());
}

export async function sherlockBuscarUsernameAction(username: string) {
  return sherlockLookupUsername(String(username || "").trim());
}

export async function sherlockPreviewUsernamesAction(nome: string) {
  return usernamesFromNome(nome);
}

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
  const configured = sherlockConfigured();
  const localhost = url ? sherlockIsLocalhostUrl(url) : false;
  const production = process.env.NODE_ENV === "production";
  const ready = configured && !(production && localhost);
  return {
    optional: true as const,
    enabled,
    urlSet: !!url,
    ready,
    localhost,
    production,
    urlPreview: url ? (localhost ? "http://127.0.0.1:…" : url.replace(/https?:\/\//, "").slice(0, 40)) : "",
    hint: !enabled
      ? "Sherlock opcional e desligado."
      : !url
        ? "SHERLOCK_ENABLED=true, mas falta SHERLOCK_API_URL."
        : production && localhost
          ? "Sherlock bloqueado: 127.0.0.1 aponta para o servidor Vercel, não para o seu PC. Configure uma URL pública HTTPS."
          : localhost
            ? "Sherlock local disponível somente durante npm run dev na sua máquina."
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

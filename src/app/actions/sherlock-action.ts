"use server";

import { sherlockConfigured, sherlockLookupNome, usernamesFromNome } from "@/lib/sherlock-client";

export async function sherlockStatusAction() {
  return {
    ready: sherlockConfigured(),
    urlSet: !!String(process.env.SHERLOCK_API_URL || "").trim(),
    enabled: ["1", "true", "yes", "on"].includes(
      String(process.env.SHERLOCK_ENABLED || "").toLowerCase()
    ),
  };
}

export async function sherlockBuscarPorNomeAction(nome: string) {
  const n = String(nome || "").trim();
  if (n.length < 5) return { ok: false, tried: [], hits: [], error: "Nome curto" };
  return sherlockLookupNome(n);
}

export async function sherlockPreviewUsernamesAction(nome: string) {
  return usernamesFromNome(nome);
}

"use client";

/**
 * Reconciliação automática ao entrar/recarregar o app.
 * Primeiro usa o cache local já disponível; não faz leitura extra do Supabase.
 */
const KEY = "lexis_hybrid_entry_sync_v2";
const MIN_INTERVAL = 15_000;
const CACHE_KEY = "lexis_carteira_sessao_v3";

function getCachedRows(): any[] {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed?.cases) ? parsed.cases : [];
  } catch {
    return [];
  }
}

export function startHybridEntrySync() {
  if (typeof window === "undefined") return;

  try {
    const last = Number(localStorage.getItem(KEY) || 0);
    if (Date.now() - last < MIN_INTERVAL) return;
    localStorage.setItem(KEY, String(Date.now()));
  } catch {
    return;
  }

  const rows = getCachedRows();
  if (!rows.length) {
    // Ainda assim acorda o endpoint para verificar a configuração do webhook.
    void fetch("/api/hybrid/auto-sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason: "app-entry", rows: [] }),
      keepalive: true,
    }).catch(() => {});
    return;
  }

  void fetch("/api/hybrid/auto-sync", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ reason: "app-entry", rows }),
    keepalive: true,
  }).catch(() => {});
}

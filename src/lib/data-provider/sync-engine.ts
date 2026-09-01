/**
 * Motor de sincronização: Local (fonte da verdade offline) ↔ Sheets (espelho).
 * Supabase pode ser plugado depois como terceiro provider.
 */
import { localProvider } from "./local-provider";
import { SheetsProvider, loadSheetsConfig } from "./sheets-provider";
import type { PullResult, PushResult } from "./types";

export type SyncStatus = {
  mode: "local_only" | "dual";
  pending: number;
  lastSyncAt: string | null;
  lastError: string | null;
  sheetsOk: boolean | null;
};

const STATUS_KEY = "lexis_unified_sync_status";

export function getSyncStatus(): SyncStatus {
  try {
    const raw = localStorage.getItem(STATUS_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    /* */
  }
  return {
    mode: loadSheetsConfig() ? "dual" : "local_only",
    pending: localProvider.peekOutbox().length,
    lastSyncAt: null,
    lastError: null,
    sheetsOk: null,
  };
}

function setStatus(p: Partial<SyncStatus>) {
  const cur = getSyncStatus();
  localStorage.setItem(STATUS_KEY, JSON.stringify({ ...cur, ...p }));
}

/** Sobe outbox local → Sheets e baixa mudanças remotas. */
export async function syncNow(): Promise<{ push: PushResult; pull: PullResult }> {
  const sheets = SheetsProvider.fromStored();
  const outbox = localProvider.peekOutbox();

  if (!sheets) {
    setStatus({
      mode: "local_only",
      pending: outbox.length,
      lastError: null,
      sheetsOk: null,
    });
    return {
      push: { ok: true, accepted: 0, conflicts: [] },
      pull: { ok: true, records: [] },
    };
  }

  const health = await sheets.health();
  if (!health.ok) {
    setStatus({
      mode: "dual",
      pending: outbox.length,
      lastError: health.detail || "Sheets offline",
      sheetsOk: false,
    });
    return {
      push: { ok: false, accepted: 0, conflicts: [], error: health.detail },
      pull: { ok: false, records: [], error: health.detail },
    };
  }

  const push = await sheets.push(outbox);
  if (push.ok && push.accepted > 0) {
    localProvider.clearOutbox(
      outbox.slice(0, push.accepted).map((r) => r.id + ":" + r.version)
    );
  }

  const pull = await sheets.pull();
  if (pull.ok && pull.records?.length) {
    await localProvider.push(pull.records);
  }

  setStatus({
    mode: "dual",
    pending: localProvider.peekOutbox().length,
    lastSyncAt: new Date().toISOString(),
    lastError: push.error || pull.error || null,
    sheetsOk: true,
  });

  return { push, pull };
}

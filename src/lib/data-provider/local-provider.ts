/**
 * LocalProvider — IndexedDB (browser) / memória no SSR.
 * Offline-first: leitura/escrita local; sync é opcional via SheetsProvider.
 */

import type {
  ClientRow,
  DataProvider,
  LeadRow,
  ProcessRow,
  SessionUser,
  SyncChange,
  SyncPullResult,
  SyncPushResult,
} from "./types";
import { getDeviceId } from "./config";

const DB_NAME = "lexis_local_v1";
const DB_VERSION = 1;
const SESSION_KEY = "lexis_local_session_v1";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB indisponível"));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      for (const name of ["processos", "leads", "clientes", "sync_queue"]) {
        if (!db.objectStoreNames.contains(name)) {
          db.createObjectStore(name, { keyPath: "id" });
        }
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbGetAll<T>(store: string): Promise<T[]> {
  try {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(store, "readonly");
      const req = tx.objectStore(store).getAll();
      req.onsuccess = () => resolve((req.result || []) as T[]);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return memAll(store) as T[];
  }
}

async function idbPut(store: string, row: Record<string, unknown>) {
  try {
    const db = await openDb();
    return new Promise<void>((resolve, reject) => {
      const tx = db.transaction(store, "readwrite");
      tx.objectStore(store).put(row);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    memPut(store, row);
  }
}

// Fallback memória (SSR / private mode)
const mem: Record<string, Map<string, Record<string, unknown>>> = {
  processos: new Map(),
  leads: new Map(),
  clientes: new Map(),
  sync_queue: new Map(),
};

function memAll(store: string) {
  return Array.from((mem[store] || new Map()).values());
}
function memPut(store: string, row: Record<string, unknown>) {
  if (!mem[store]) mem[store] = new Map();
  mem[store].set(String(row.id), row);
}

function readSession(): SessionUser | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as SessionUser) : null;
  } catch {
    return null;
  }
}

function writeSession(u: SessionUser | null) {
  if (typeof window === "undefined") return;
  if (!u) localStorage.removeItem(SESSION_KEY);
  else localStorage.setItem(SESSION_KEY, JSON.stringify(u));
}

function stamp<T extends Record<string, unknown>>(row: T): T {
  const now = new Date().toISOString();
  return {
    ...row,
    updatedAt: now,
    version: Number(row.version || 0) + 1,
    deviceId: getDeviceId(),
  };
}

async function enqueue(change: SyncChange) {
  await idbPut("sync_queue", { ...change, id: `${change.table}:${change.id}:${change.updatedAt}` });
}

export function createLocalProvider(): DataProvider {
  return {
    kind: "local",
    auth: {
      async login(login, password) {
        // Local puro: aceita se já houver sessão sheets, ou modo demo
        if (!login || !password) return { ok: false, error: "Informe usuário e senha" };
        const user: SessionUser = {
          id: "local_" + login,
          login,
          nome: login,
          role: "operador",
          empresaId: "local",
          token: "local",
        };
        writeSession(user);
        return { ok: true, user };
      },
      async logout() {
        writeSession(null);
      },
      currentUser() {
        return readSession();
      },
    },
    processes: {
      async list() {
        const rows = await idbGetAll<ProcessRow>("processos");
        return rows.filter((r) => !r.deleted);
      },
      async upsert(row) {
        const next = stamp({ ...row, id: row.id || crypto.randomUUID() }) as ProcessRow;
        await idbPut("processos", next as unknown as Record<string, unknown>);
        await enqueue({
          table: "processos",
          id: next.id,
          op: "upsert",
          payload: next as unknown as Record<string, unknown>,
          updatedAt: String(next.updatedAt),
          version: Number(next.version || 1),
          deviceId: getDeviceId(),
        });
        return next;
      },
      async remove(id) {
        const rows = await idbGetAll<ProcessRow>("processos");
        const found = rows.find((r) => r.id === id);
        if (found) {
          const next = stamp({ ...found, deleted: true });
          await idbPut("processos", next as unknown as Record<string, unknown>);
          await enqueue({
            table: "processos",
            id,
            op: "delete",
            payload: { id },
            updatedAt: String(next.updatedAt),
            version: Number(next.version || 1),
            deviceId: getDeviceId(),
          });
        }
      },
    },
    leads: {
      async list() {
        return (await idbGetAll<LeadRow>("leads")).filter((r) => !r.deleted);
      },
      async upsert(row) {
        const next = stamp({ ...row, id: row.id || crypto.randomUUID() }) as LeadRow;
        await idbPut("leads", next as unknown as Record<string, unknown>);
        await enqueue({
          table: "leads",
          id: next.id,
          op: "upsert",
          payload: next as unknown as Record<string, unknown>,
          updatedAt: String(next.updatedAt),
          version: Number(next.version || 1),
          deviceId: getDeviceId(),
        });
        return next;
      },
    },
    clients: {
      async list() {
        return (await idbGetAll<ClientRow>("clientes")).filter((r) => !r.deleted);
      },
      async upsert(row) {
        const next = stamp({ ...row, id: row.id || crypto.randomUUID() }) as ClientRow;
        await idbPut("clientes", next as unknown as Record<string, unknown>);
        await enqueue({
          table: "clientes",
          id: next.id,
          op: "upsert",
          payload: next as unknown as Record<string, unknown>,
          updatedAt: String(next.updatedAt),
          version: Number(next.version || 1),
          deviceId: getDeviceId(),
        });
        return next;
      },
    },
    sync: {
      async push() {
        const q = await idbGetAll<SyncChange & { id: string }>("sync_queue");
        return { ok: true, applied: 0, conflicts: 0, error: "Use SheetsProvider para push remoto" };
      },
      async pull(): Promise<SyncPullResult> {
        return { ok: true, processes: await idbGetAll("processos"), leads: await idbGetAll("leads") };
      },
      async ping() {
        return { ok: true };
      },
    },
  };
}

/** Exporta fila pendente (para o SheetsProvider consumir) */
export async function getLocalSyncQueue(): Promise<SyncChange[]> {
  return idbGetAll<SyncChange>("sync_queue");
}

export async function clearLocalSyncQueueItem(queueId: string) {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction("sync_queue", "readwrite");
      tx.objectStore("sync_queue").delete(queueId);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    mem.sync_queue?.delete(queueId);
  }
}

export async function importRowsToLocal(
  table: "processos" | "leads" | "clientes",
  rows: Record<string, unknown>[],
) {
  for (const row of rows) {
    if (!row.id) row.id = crypto.randomUUID();
    await idbPut(table, row);
  }
}

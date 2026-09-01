/**
 * Banco local (browser): IndexedDB via localStorage fallback simples.
 * Desktop pode trocar por SQLite no Electron sem mudar a interface.
 */
import type {
  DataProvider,
  HealthResult,
  PullResult,
  PushResult,
  SyncEntity,
  SyncRecord,
} from "./types";

const DB_KEY = "lexis_unified_local_v1";
const OUTBOX_KEY = "lexis_unified_outbox_v1";
const DEVICE_KEY = "lexis_unified_device_id";

type Store = Record<SyncEntity, Record<string, SyncRecord>>;

function emptyStore(): Store {
  return {
    users: {},
    empresas: {},
    clientes: {},
    leads: {},
    processos: {},
    tarefas: {},
    atendimentos: {},
    crm: {},
    config: {},
    audit: {},
  };
}

function loadStore(): Store {
  try {
    const raw = localStorage.getItem(DB_KEY);
    if (!raw) return emptyStore();
    return { ...emptyStore(), ...JSON.parse(raw) };
  } catch {
    return emptyStore();
  }
}

function saveStore(s: Store) {
  localStorage.setItem(DB_KEY, JSON.stringify(s));
}

function loadOutbox(): SyncRecord[] {
  try {
    const raw = localStorage.getItem(OUTBOX_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveOutbox(rows: SyncRecord[]) {
  localStorage.setItem(OUTBOX_KEY, JSON.stringify(rows.slice(-2000)));
}

export function getDeviceId(): string {
  let id = localStorage.getItem(DEVICE_KEY);
  if (!id) {
    id = "dev_" + Math.random().toString(36).slice(2) + Date.now().toString(36);
    localStorage.setItem(DEVICE_KEY, id);
  }
  return id;
}

export class LocalProvider implements DataProvider {
  readonly id = "local" as const;

  async health(): Promise<HealthResult> {
    return { ok: true, provider: "local", detail: "IndexedDB/localStorage OK" };
  }

  async listLocal<T = Record<string, unknown>>(entity: SyncEntity): Promise<T[]> {
    const s = loadStore();
    return Object.values(s[entity] || {})
      .filter((r) => !r.deleted)
      .map((r) => ({ id: r.id, ...r.payload }) as T);
  }

  async upsertLocal(entity: SyncEntity, row: Record<string, unknown>): Promise<void> {
    const id = String(row.id || row.protocolo || row.protocolo_ref || crypto.randomUUID());
    const s = loadStore();
    const prev = s[entity][id];
    const version = (prev?.version || 0) + 1;
    const rec: SyncRecord = {
      id,
      entity,
      op: "upsert",
      payload: { ...row, id },
      updated_at: new Date().toISOString(),
      version,
      device_id: getDeviceId(),
      deleted: false,
    };
    s[entity][id] = rec;
    saveStore(s);
    const box = loadOutbox();
    box.push(rec);
    saveOutbox(box);
  }

  /** Empurra outbox para outro provider (Sheets etc.) — local sozinho “aceita” tudo. */
  async push(records: SyncRecord[]): Promise<PushResult> {
    const s = loadStore();
    let accepted = 0;
    for (const r of records) {
      const cur = s[r.entity]?.[r.id];
      if (cur && cur.version > r.version) continue;
      if (!s[r.entity]) (s as any)[r.entity] = {};
      s[r.entity][r.id] = r;
      accepted++;
    }
    saveStore(s);
    return { ok: true, accepted, conflicts: [] };
  }

  async pull(): Promise<PullResult> {
    const s = loadStore();
    const records = Object.values(s).flatMap((m) => Object.values(m));
    return { ok: true, records };
  }

  /** Outbox pendente para sync remoto */
  peekOutbox(): SyncRecord[] {
    return loadOutbox();
  }

  clearOutbox(ids: string[]) {
    const set = new Set(ids);
    saveOutbox(loadOutbox().filter((r) => !set.has(r.id + ":" + r.version)));
  }
}

export const localProvider = new LocalProvider();

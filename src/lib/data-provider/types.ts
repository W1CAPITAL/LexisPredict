/**
 * LEXIS UNIFIED — contrato do Data Provider
 * Supabase deixa de ser obrigatório. Local + Sheets (+ opcional Supabase).
 */

export type ProviderId = "local" | "sheets" | "supabase";

export type SyncOp = "upsert" | "delete";

export type SyncEntity =
  | "users"
  | "empresas"
  | "clientes"
  | "leads"
  | "processos"
  | "tarefas"
  | "atendimentos"
  | "crm"
  | "config"
  | "audit";

export type SyncRecord = {
  id: string;
  entity: SyncEntity;
  op: SyncOp;
  payload: Record<string, unknown>;
  updated_at: string; // ISO
  version: number;
  device_id: string;
  deleted?: boolean;
};

export type SessionUser = {
  id: string;
  name: string;
  email?: string;
  role: string;
  empresaId?: string;
  token?: string;
};

export type LoginResult =
  | { ok: true; user: SessionUser }
  | { ok: false; error: string };

export type PushResult = {
  ok: boolean;
  accepted: number;
  conflicts: Array<{ id: string; entity: SyncEntity; reason: string }>;
  error?: string;
};

export type PullResult = {
  ok: boolean;
  records: SyncRecord[];
  cursor?: string;
  error?: string;
};

export type HealthResult = {
  ok: boolean;
  provider: ProviderId;
  detail?: string;
};

/** Interface única — Core do Lexis fala só com isto. */
export interface DataProvider {
  readonly id: ProviderId;
  health(): Promise<HealthResult>;
  login?(user: string, password: string): Promise<LoginResult>;
  /** Fila local → remoto */
  push(records: SyncRecord[]): Promise<PushResult>;
  /** Remoto → local (desde cursor) */
  pull(opts?: { cursor?: string; entities?: SyncEntity[] }): Promise<PullResult>;
  /** Leitura rápida local (quando provider é local ou cache) */
  listLocal?<T = Record<string, unknown>>(entity: SyncEntity): Promise<T[]>;
  upsertLocal?(entity: SyncEntity, row: Record<string, unknown>): Promise<void>;
}

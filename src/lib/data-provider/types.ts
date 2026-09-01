/**
 * Lexis Unified — abstração de dados (Supabase opcional).
 * Local / Sheets / Supabase implementam a mesma interface.
 */

export type ProviderKind = "local" | "sheets" | "supabase";

export type SessionUser = {
  id: string;
  login: string;
  nome: string;
  email?: string;
  role: string;
  empresaId: string;
  token?: string;
};

export type ProcessRow = {
  id: string;
  protocolo: string;
  cliente: string;
  status?: string;
  situacao?: string;
  ultimoRetorno?: string;
  proximoRetorno?: string;
  advogado?: string;
  telefone?: string;
  createdBy?: string;
  responsavel?: string;
  observacao?: string;
  empresaId?: string;
  updatedAt?: string;
  version?: number;
  deleted?: boolean;
  [key: string]: unknown;
};

export type LeadRow = {
  id: string;
  nome: string;
  whatsapp?: string;
  cpf?: string;
  status?: string;
  consentAt?: string | null;
  score?: number;
  source?: string;
  updatedAt?: string;
  version?: number;
  deleted?: boolean;
  [key: string]: unknown;
};

export type ClientRow = {
  id: string;
  nome: string;
  telefone?: string;
  cpf?: string;
  email?: string;
  status?: string;
  updatedAt?: string;
  version?: number;
  deleted?: boolean;
  [key: string]: unknown;
};

export type SyncChange = {
  table: "processos" | "leads" | "clientes" | "usuarios" | "tarefas" | "crm";
  id: string;
  op: "upsert" | "delete";
  payload: Record<string, unknown>;
  updatedAt: string;
  version: number;
  deviceId: string;
};

export type SyncPullResult = {
  ok: boolean;
  processes?: ProcessRow[];
  leads?: LeadRow[];
  clients?: ClientRow[];
  serverTime?: string;
  error?: string;
};

export type SyncPushResult = {
  ok: boolean;
  applied?: number;
  conflicts?: number;
  error?: string;
};

export interface DataProvider {
  kind: ProviderKind;
  auth: {
    login(login: string, password: string): Promise<{ ok: boolean; user?: SessionUser; error?: string }>;
    logout(): Promise<void>;
    currentUser(): SessionUser | null;
  };
  processes: {
    list(opts?: { onlyMine?: boolean }): Promise<ProcessRow[]>;
    upsert(row: ProcessRow): Promise<ProcessRow>;
    remove(id: string): Promise<void>;
  };
  leads: {
    list(): Promise<LeadRow[]>;
    upsert(row: LeadRow): Promise<LeadRow>;
  };
  clients: {
    list(): Promise<ClientRow[]>;
    upsert(row: ClientRow): Promise<ClientRow>;
  };
  sync: {
    push(changes: SyncChange[]): Promise<SyncPushResult>;
    pull(since?: string): Promise<SyncPullResult>;
    ping(): Promise<{ ok: boolean; error?: string }>;
  };
}

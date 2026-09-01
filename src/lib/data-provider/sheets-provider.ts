/**
 * Google Sheets via Apps Script Web App (doPost/doGet).
 * Não abre a planilha no browser com credencial do usuário —
 * o script é a autoridade (login, sync, validação).
 */
import type {
  DataProvider,
  HealthResult,
  LoginResult,
  PullResult,
  PushResult,
  SyncRecord,
} from "./types";

export type SheetsConfig = {
  /** URL .../exec do Apps Script */
  webhookUrl: string;
  token: string;
  sheetId?: string;
};

const CFG_KEY = "lexis_unified_sheets_cfg";

export function loadSheetsConfig(): SheetsConfig | null {
  try {
    const raw = localStorage.getItem(CFG_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveSheetsConfig(cfg: SheetsConfig) {
  localStorage.setItem(CFG_KEY, JSON.stringify(cfg));
}

async function callScript(
  cfg: SheetsConfig,
  body: Record<string, unknown>
): Promise<any> {
  const res = await fetch(cfg.webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify({ token: cfg.token, ...body }),
  });
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(text.slice(0, 200) || `HTTP ${res.status}`);
  }
}

export class SheetsProvider implements DataProvider {
  readonly id = "sheets" as const;
  constructor(private cfg: SheetsConfig) {}

  static fromStored(): SheetsProvider | null {
    const cfg = loadSheetsConfig();
    if (!cfg?.webhookUrl || !cfg?.token) return null;
    return new SheetsProvider(cfg);
  }

  async health(): Promise<HealthResult> {
    try {
      const j = await callScript(this.cfg, { action: "health" });
      return { ok: !!j?.ok, provider: "sheets", detail: j?.message || "ok" };
    } catch (e: any) {
      return { ok: false, provider: "sheets", detail: e?.message || "falha" };
    }
  }

  async login(user: string, password: string): Promise<LoginResult> {
    try {
      const j = await callScript(this.cfg, { action: "login", user, password });
      if (!j?.ok) return { ok: false, error: j?.error || "login falhou" };
      return {
        ok: true,
        user: {
          id: String(j.userId || j.id),
          name: String(j.name || user),
          email: j.email,
          role: String(j.role || "operador"),
          empresaId: j.companyId || j.empresaId,
          token: j.session || j.token,
        },
      };
    } catch (e: any) {
      return { ok: false, error: e?.message || "rede" };
    }
  }

  async push(records: SyncRecord[]): Promise<PushResult> {
    try {
      const j = await callScript(this.cfg, { action: "sync_push", records });
      return {
        ok: !!j?.ok,
        accepted: Number(j?.accepted || 0),
        conflicts: j?.conflicts || [],
        error: j?.error,
      };
    } catch (e: any) {
      return { ok: false, accepted: 0, conflicts: [], error: e?.message };
    }
  }

  async pull(opts?: { cursor?: string }): Promise<PullResult> {
    try {
      const j = await callScript(this.cfg, {
        action: "sync_pull",
        cursor: opts?.cursor,
      });
      return {
        ok: !!j?.ok,
        records: j?.records || [],
        cursor: j?.cursor,
        error: j?.error,
      };
    } catch (e: any) {
      return { ok: false, records: [], error: e?.message };
    }
  }
}

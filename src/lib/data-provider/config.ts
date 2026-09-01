/**
 * Configuração do provider ativo + credenciais Sheets (localStorage).
 */

import type { ProviderKind } from "./types";

export type SheetsConnection = {
  webhookUrl: string;
  token: string;
  spreadsheetHint?: string;
};

export type ProviderConfig = {
  kind: ProviderKind;
  sheets: SheetsConnection;
  deviceId: string;
};

const CFG_KEY = "lexis_data_provider_cfg_v1";
const DEVICE_KEY = "lexis_device_id_v1";

function uuid() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return "dev_" + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export function getDeviceId(): string {
  if (typeof window === "undefined") return "server";
  try {
    let id = localStorage.getItem(DEVICE_KEY);
    if (!id) {
      id = uuid();
      localStorage.setItem(DEVICE_KEY, id);
    }
    return id;
  } catch {
    return uuid();
  }
}

export function loadProviderConfig(): ProviderConfig {
  const defaults: ProviderConfig = {
    kind: (process.env.NEXT_PUBLIC_DATA_PROVIDER as ProviderKind) || "supabase",
    sheets: { webhookUrl: "", token: "w1-fase1-2026" },
    deviceId: getDeviceId(),
  };
  if (typeof window === "undefined") return defaults;
  try {
    const raw = localStorage.getItem(CFG_KEY);
    if (!raw) return { ...defaults, deviceId: getDeviceId() };
    const parsed = JSON.parse(raw) as Partial<ProviderConfig>;
    return {
      kind: parsed.kind || defaults.kind,
      sheets: {
        webhookUrl: parsed.sheets?.webhookUrl || "",
        token: parsed.sheets?.token || "w1-fase1-2026",
        spreadsheetHint: parsed.sheets?.spreadsheetHint,
      },
      deviceId: parsed.deviceId || getDeviceId(),
    };
  } catch {
    return { ...defaults, deviceId: getDeviceId() };
  }
}

export function saveProviderConfig(cfg: ProviderConfig) {
  if (typeof window === "undefined") return;
  localStorage.setItem(CFG_KEY, JSON.stringify(cfg));
}

/** true = usar caminho local/sheets em vez de forçar só Supabase */
export function isLocalFirstEnabled(): boolean {
  if (typeof window === "undefined") {
    return process.env.NEXT_PUBLIC_DATA_PROVIDER === "local" ||
      process.env.NEXT_PUBLIC_DATA_PROVIDER === "sheets";
  }
  const k = loadProviderConfig().kind;
  return k === "local" || k === "sheets";
}

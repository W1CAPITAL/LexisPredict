export type HybridMode = "off" | "sheets_carteira" | "sheets_carteira_scan";

// Carteira operacional: Sheets é o destino primário quando o híbrido está ligado.
// O encerramento automático fica FORÇADO desligado nesta versão.
if (typeof process !== "undefined") {
  process.env.SCAN_AUTO_ENCERRAR = "0";
}

export function getHybridMode(): HybridMode {
  const v = String(process.env.LEXIS_HYBRID_MODE || process.env.NEXT_PUBLIC_LEXIS_HYBRID_MODE || "sheets_carteira")
    .trim()
    .toLowerCase();
  if (v === "off" || v === "none") return "off";
  if (v === "sheets_carteira_scan" || v === "full" || v === "scan") return "sheets_carteira_scan";
  return "sheets_carteira";
}

export function hybridEnabled(): boolean {
  return getHybridMode() !== "off";
}

export function hybridMirrorPostgres(): boolean {
  const v = String(process.env.LEXIS_HYBRID_MIRROR_PG || "false").toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}

export function hybridSkipScanAudit(): boolean {
  const v = String(process.env.LEXIS_HYBRID_SKIP_SCAN_AUDIT || "true").toLowerCase();
  return v !== "0" && v !== "false" && v !== "no";
}

export function autoEncerrarEnabled(): boolean {
  return false;
}

export const HYBRID_SHEETS_ENV = {
  webhook: "LEXIS_SHEETS_WEBHOOK_URL",
  token: "LEXIS_SHEETS_TOKEN",
} as const;

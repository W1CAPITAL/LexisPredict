export type HybridMode = "off" | "sheets_carteira" | "sheets_carteira_scan";

/**
 * Supabase é a fonte oficial do produto.
 * Google Sheets funciona como espelho/Plano B e nunca pode esconder registros
 * que existem no banco nem bloquear uma gravação da operação.
 *
 * Para reativar leitura primária pelo Sheets em um ambiente controlado:
 * LEXIS_HYBRID_DB_FIRST=false
 */
export function dbFirstEnabled(): boolean {
  const v = String(process.env.LEXIS_HYBRID_DB_FIRST ?? "true").trim().toLowerCase();
  return !["0", "false", "no", "off"].includes(v);
}

export function getHybridMode(): HybridMode {
  if (dbFirstEnabled()) return "off";
  const v = String(
    process.env.LEXIS_HYBRID_MODE ||
      process.env.NEXT_PUBLIC_LEXIS_HYBRID_MODE ||
      "sheets_carteira",
  )
    .trim()
    .toLowerCase();
  if (v === "off" || v === "none") return "off";
  if (v === "sheets_carteira_scan" || v === "full" || v === "scan") {
    return "sheets_carteira_scan";
  }
  return "sheets_carteira";
}

/**
 * Leitura híbrida fica desligada por padrão: /processos nunca perde casos
 * porque eles ainda não chegaram à planilha.
 */
export function hybridEnabled(): boolean {
  return !dbFirstEnabled() && getHybridMode() !== "off";
}

/**
 * Mantém a possibilidade de espelhamento/telemetria sem transformar Sheets
 * em dependência de leitura.
 */
export function hybridMirrorPostgres(): boolean {
  const v = String(process.env.LEXIS_HYBRID_MIRROR_PG || "false").toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}

export function hybridSkipScanAudit(): boolean {
  const v = String(process.env.LEXIS_HYBRID_SKIP_SCAN_AUDIT || "true").toLowerCase();
  return v !== "0" && v !== "false" && v !== "no";
}

/** Autoencerrar humano/automático permanece permanentemente desligado. */
export function autoEncerrarEnabled(): boolean {
  return false;
}

export const HYBRID_SHEETS_ENV = {
  webhook: "LEXIS_SHEETS_WEBHOOK_URL",
  token: "LEXIS_SHEETS_TOKEN",
} as const;

/**
 * Política Híbrida LexisPredict
 * ============================
 * Supabase (Postgres): usuários, empresa, permissões, sessão Auth.
 * Google Sheets (webhook Apps Script): carteira operacional — protocolo,
 *   RETORNO (M), PRÓXIMO (N), andamento DataJud/DJEN, flags leves de scan.
 *
 * Objetivo: reduzir drasticamente leituras/escritas em `processos` e
 * `auditoria_logs_app` (hoje 100k+ linhas), especialmente no scanner.
 */

export type HybridMode = "off" | "sheets_carteira" | "sheets_carteira_scan";

export function getHybridMode(): HybridMode {
  const v = String(process.env.LEXIS_HYBRID_MODE || process.env.NEXT_PUBLIC_LEXIS_HYBRID_MODE || "off")
    .trim()
    .toLowerCase();
  if (v === "sheets_carteira" || v === "carteira") return "sheets_carteira";
  if (v === "sheets_carteira_scan" || v === "full" || v === "scan") return "sheets_carteira_scan";
  return "off";
}

export function hybridEnabled(): boolean {
  return getHybridMode() !== "off";
}

/** Quando true, scan ainda grava um patch mínimo no Postgres (flags críticas). Default false no modo scan. */
export function hybridMirrorPostgres(): boolean {
  const v = String(process.env.LEXIS_HYBRID_MIRROR_PG || "false").toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}

/** Pular insert em auditoria_logs_app para scans automáticos (maior vilão de volume). */
export function hybridSkipScanAudit(): boolean {
  const v = String(process.env.LEXIS_HYBRID_SKIP_SCAN_AUDIT || "true").toLowerCase();
  return v !== "0" && v !== "false" && v !== "no";
}

export const HYBRID_SHEETS_ENV = {
  webhook: "LEXIS_SHEETS_WEBHOOK_URL",
  token: "LEXIS_SHEETS_TOKEN",
} as const;

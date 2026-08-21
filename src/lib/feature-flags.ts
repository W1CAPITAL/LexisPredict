/**
 * Feature flags por env (Vercel) ou override local.
 * Use para desligar módulos instáveis sem redeploy de código.
 *
 * Exemplos no Vercel:
 *   FF_AUTOMACAO_JUDICIAL=0
 *   FF_WHATSAPP_EVOLUTION=1
 *   FF_SCANNER_DJEN=1
 */

function envFlag(key: string, defaultOn = true): boolean {
  const v = process.env[key];
  if (v === undefined || v === "") return defaultOn;
  return v === "1" || v.toLowerCase() === "true" || v === "yes";
}

export const flags = {
  /** Pipeline 01–08 de automação judicial */
  automacaoJudicial: () => envFlag("FF_AUTOMACAO_JUDICIAL", true),
  /** Integração Evolution / WhatsApp */
  whatsappEvolution: () => envFlag("FF_WHATSAPP_EVOLUTION", true),
  /** Scanner DJEN em lote */
  scannerDjen: () => envFlag("FF_SCANNER_DJEN", true),
  /** Rascunho IA opcional na Fila */
  iaRascunho: () => envFlag("FF_IA_RASCUNHO", true),
  /** Sentry / reporting */
  sentry: () => Boolean(process.env.NEXT_PUBLIC_SENTRY_DSN),
} as const;

export type FlagName = keyof typeof flags;

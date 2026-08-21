/**
 * Sentry opcional. Ative com NEXT_PUBLIC_SENTRY_DSN no Vercel.
 * Sem DSN = no-op (zero custo, zero dependência obrigatória).
 *
 * Para ligar de verdade:
 *   npm i @sentry/nextjs
 *   e configure sentry.client.config.ts / sentry.server.config.ts
 * Este arquivo só centraliza o contrato para o resto do app.
 */

type SentryLike = {
  captureException: (err: unknown, ctx?: Record<string, unknown>) => void;
  captureMessage: (msg: string, level?: string) => void;
};

const noop: SentryLike = {
  captureException: () => {},
  captureMessage: () => {},
};

export function getSentry(): SentryLike {
  if (typeof window === "undefined") {
    // server: só no-op até instalar @sentry/nextjs
    return noop;
  }
  const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
  if (!dsn) return noop;
  // Quando @sentry/nextjs estiver instalado, reexporte de lá.
  return noop;
}

export function reportError(err: unknown, ctx?: Record<string, unknown>) {
  getSentry().captureException(err, ctx);
  if (process.env.NODE_ENV === "development") {
    console.error("[reportError]", err, ctx);
  }
}

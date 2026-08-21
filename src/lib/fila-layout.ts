/**
 * Tokens de layout da Fila — web first-class.
 * Use nas className da página /tarefas para evitar “só funciona no app”.
 */

export const filaLayout = {
  /** Container principal da página */
  page: "flex h-[100dvh] min-h-0 bg-background font-sans text-foreground overflow-hidden",
  main: "flex-1 flex flex-col min-h-0 min-w-0 overflow-hidden",
  header:
    "h-auto shrink-0 border-b border-border/50 bg-card/60 backdrop-blur-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3 sm:p-4 sm:px-8 z-40",
  body: "flex-1 min-h-0 overflow-y-auto overflow-x-hidden p-3 sm:p-6 md:p-8 max-w-[1400px] mx-auto w-full space-y-6 sm:space-y-10 pb-28",
  /** Área de toque mínima (mobile) */
  touch: "min-h-[44px] min-w-[44px]",
  card: "rounded-2xl border border-border/40 bg-card/80 p-4 sm:p-5 transition-shadow hover:shadow-md",
  cardFocus: "ring-2 ring-primary/50 shadow-lg",
  cardKb: "outline outline-2 outline-offset-2 outline-primary",
} as const;

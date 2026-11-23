/**
 * Menu essencial: uma área por objetivo; módulos especializados ficam em Mais.
 * Não filtra permissões: recebe somente destinos já autorizados pelo layout.
 */
const PRIMARY_NAV_GROUPS = [
  ["/"],
  ["/processos", "/cases"], // mesma finalidade; prioriza carteira da empresa
  ["/tarefas"],
  ["/agenda"],
  ["/whatsapp"],
  ["/documents"],
] as const;

export const PRIMARY_NAV_ORDER = [
  "/", "/processos", "/tarefas", "/agenda", "/whatsapp", "/documents",
] as const;

const PRIMARY_LABELS: Readonly<Record<string, string>> = {
  "/": "Início",
  "/processos": "Processos",
  "/cases": "Processos",
  "/tarefas": "Atividades",
  "/agenda": "Agenda",
  "/whatsapp": "WhatsApp",
  "/documents": "Documentos",
};

export function getPrimaryNavigationLabel(href: string, fallback: string): string {
  return PRIMARY_LABELS[href] ?? fallback;
}

export function selectPrimaryNavigationItems<T extends { href: string }>(
  allowedItems: readonly T[],
): T[] {
  const indexed = new Map<string, T>();
  for (const item of allowedItems) {
    if (!indexed.has(item.href)) indexed.set(item.href, item);
  }
  return PRIMARY_NAV_GROUPS.flatMap((options) => {
    const selected = options.find((href) => indexed.has(href));
    return selected ? [indexed.get(selected)!] : [];
  });
}

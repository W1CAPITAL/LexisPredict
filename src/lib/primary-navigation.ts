/**
 * Os seis destinos de trabalho rápido do desktop.
 * Recursos especializados continuam na Central e são filtrados
 * pelo mesmo perfil/plano antes da seleção.
 */
export const PRIMARY_NAV_ORDER = [
  "/", "/tarefas", "/vencidos", "/cases", "/processos", "/whatsapp",
] as const;

export function selectPrimaryNavigationItems<T extends { href: string }>(
  allowedItems: readonly T[],
): T[] {
  const indexed = new Map(allowedItems.map((item) => [item.href, item]));
  return PRIMARY_NAV_ORDER.flatMap((href) => {
    const item = indexed.get(href);
    return item ? [item] : [];
  });
}

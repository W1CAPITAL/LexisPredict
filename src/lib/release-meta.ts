/**
 * Metadados de release para UI e /api/version.
 * Atualize APP_VERSION no deploy ou via env NEXT_PUBLIC_APP_VERSION.
 */

export const APP_VERSION =
  process.env.NEXT_PUBLIC_APP_VERSION ||
  process.env.npm_package_version ||
  "1.13.2";

export type ReleaseNote = {
  version: string;
  date: string;
  bullets: string[];
};

/** Notas recentes — edite a cada release (ou gere via script). */
export const RELEASE_NOTES: ReleaseNote[] = [
  {
    version: "1.13.3",
    date: "2026-08-21",
    bullets: [
      "CI: Node 24 + lint + typecheck + testes + build obrigatórios",
      "Correção export duplicado sanitizePecaTexto",
      "Correção JSX da Fila Crítica (modo web)",
    ],
  },
  {
    version: "1.13.2",
    date: "2026-08-20",
    bullets: ["Release anterior"],
  },
];

export function latestNotes(n = 5): ReleaseNote[] {
  return RELEASE_NOTES.slice(0, n);
}

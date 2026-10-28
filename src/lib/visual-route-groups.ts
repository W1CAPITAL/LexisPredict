/** Visual grouping for every existing App Router page; styling only, no routing effects. */
export type VisualRouteGroup =
  | "workspace" | "cases" | "documents" | "crm" | "operations"
  | "communication" | "ai" | "admin" | "utilities" | "auth" | "general";

export const VISUAL_ROUTE_SEGMENTS: Readonly<Record<Exclude<VisualRouteGroup, "general">, readonly string[]>> = {
  "workspace": [
    "",
    "analises-internas",
    "analytics",
    "desktop",
    "efferd-demo",
    "estatistica-cnj",
    "insights",
    "premios",
    "report",
    "supervisao",
    "veredito"
  ],
  "cases": [
    "busca-apreensao",
    "cases",
    "consulta-bases",
    "cumprimentos-procedentes",
    "encerrados-revisao",
    "fases-provas",
    "gerador-processos",
    "investigacao-predatoria",
    "juridico",
    "processos",
    "processos-parados",
    "revisional"
  ],
  "documents": [
    "documents",
    "dossies",
    "habilitacao-peca",
    "modelos",
    "revogacao-poderes",
    "substabelecimento",
    "substabelecimento-peca",
    "substabelecimento-simples"
  ],
  "crm": [
    "clients",
    "companies",
    "crm",
    "db-csv",
    "deals",
    "financas",
    "import",
    "people"
  ],
  "operations": [
    "agenda",
    "auditoria",
    "automacao-judicial",
    "etica-operacional",
    "ia-sync",
    "integracoes",
    "minhas-atividades",
    "notificacoes",
    "ops",
    "tarefas",
    "urgency",
    "vencidos"
  ],
  "communication": [
    "chat",
    "chat-ia",
    "chatbot-separado",
    "mensagens",
    "notes",
    "superagente",
    "whatsapp"
  ],
  "ai": [
    "ai-lab",
    "autoaprimoramento",
    "estudio-agentes",
    "mapa-codigo",
    "plano-b",
    "world-lab"
  ],
  "admin": [
    "modo-seguranca",
    "offline",
    "onboarding",
    "planos",
    "plugins",
    "primeiro-acesso",
    "security",
    "settings",
    "setup-empresa",
    "setup-planilha",
    "superadmin",
    "team"
  ],
  "utilities": [
    "calculos",
    "tools",
    "visualizador-csv",
    "visualizador-db",
    "vitrine-fx"
  ],
  "auth": [
    "login",
    "signup",
    "termos"
  ]
} as const;

/** Covers nested paths, including /crm/*, /report/completo and /companies/[id].
 * The root "/" is assigned only when the pathname is exactly "/".
 * Unregistered future sections still get the generic global style. */
export function getVisualRouteGroup(pathname: string | null | undefined): VisualRouteGroup {
  const raw = (pathname || "/").split(/[?#]/, 1)[0];
  const normalized = raw === "/" ? "/" : raw.replace(/\/+$/, "");
  const section = normalized === "/" ? "" : normalized.split("/")[1] || "";
  for (const [group, sections] of Object.entries(VISUAL_ROUTE_SEGMENTS)) {
    if (sections.includes(section)) return group as VisualRouteGroup;
  }
  return "general";
}

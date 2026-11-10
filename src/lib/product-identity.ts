/**
 * Identidade de produto — Suite operacional de carteira jurídica
 * (não CRM de vendas genérico).
 */
export const PRODUCT = {
  name: "LexisPredict",
  tagline: "Suite operacional de carteira jurídica",
  subtitle: "Gabinete · prazos · tribunal · filas de ação",
  oneLiner:
    "Centraliza processos, prazos, atendimento e sinais de tribunal (DataJud/DJEN) para o time trabalhar a carteira — não um CRM de vendas.",
  notCrm:
    "Não substitui CRM comercial. Substitui planilha + caos de gabinete + olhar processo a processo no tribunal.",
  versionLabel: "Suite jurídica",
} as const;

/** Grupos de navegação — narrativa de suite, não de pipeline de vendas */
export const NAV_SUITE_GROUPS = {
  operacao: "Operação do gabinete",
  acao: "Ação jurídica",
  inteligencia: "Inteligência e documentos",
  gestao: "Gestão e equipe",
  comercial: "Comercial (opcional)",
  sistema: "Sistema",
} as const;

export const SUITE_PILARES = [
  {
    id: "carteira",
    title: "Carteira",
    desc: "Fila de retornos da empresa, por urgência, e busca da carteira completa",
    href: "/cases",
  },
  {
    id: "filas",
    title: "Filas",
    desc: "Retornos vencidos e previstos para hoje, com prioridade operacional",
    href: "/tarefas",
  },
  {
    id: "tribunal",
    title: "Tribunal",
    desc: "DataJud, DJEN, baixas, cumprimento e motores de scan",
    href: "/processos",
  },
  {
    id: "gestao",
    title: "Gestão",
    desc: "Supervisão, ranking, dossiê e indicadores da operação",
    href: "/supervisao",
  },
] as const;

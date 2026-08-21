/**
 * Pacotes comerciais do LexisPredict.
 * Plano máximo = união de todos os pacotes.
 */

export const PLAN_IDS = ["essencial", "operacional", "financeiro", "maximo"] as const;
export type PlanId = (typeof PLAN_IDS)[number];

export const PACOTE_IDS = ["essencial", "operacional", "financeiro"] as const;
export type PacoteId = (typeof PACOTE_IDS)[number];

export const PLAN_LABEL: Record<PlanId, string> = {
  essencial: "Essencial",
  operacional: "Operacional",
  financeiro: "Financeiro",
  maximo: "Máximo",
};

export const PLAN_BLURB: Record<PlanId, string> = {
  essencial: "Painel, carteira, tarefas, cadastro e configurações.",
  operacional: "Essencial + tribunal, WhatsApp, peças, parados e alertas.",
  financeiro: "Essencial + CRM, caixa e dossiê.",
  maximo: "Todos os pacotes (essencial + operacional + financeiro).",
};

/** O que cada plano libera. Máximo inclui tudo. */
export const PLAN_PACOTES: Record<PlanId, PacoteId[]> = {
  essencial: ["essencial"],
  operacional: ["essencial", "operacional"],
  financeiro: ["essencial", "financeiro"],
  maximo: ["essencial", "operacional", "financeiro"],
};

const PREFIX: Record<PacoteId, string[]> = {
  essencial: [
    "/",
    "/cases",
    "/tarefas",
    "/processos",
    "/clients",
    "/import",
    "/notes",
    "/onboarding",
    "/settings",
    "/login",
    "/signup",
    "/team",
    "/agenda",
    "/termos",
  ],
  operacional: [
    "/whatsapp",
    "/processos-parados",
    "/veredito",
    "/busca-apreensao",
    "/notificacoes",
    "/documents",
    "/tools",
    "/urgency",
    "/insights",
    "/auditoria",
    "/automacao-judicial",
    "/ia-sync",
    "/chat",
    "/chat-ia",
    "/substabelecimento",
    "/habilitacao-peca",
    "/revisional",
    "/revogacao-poderes",
    "/modelos",
    "/investigacao-predatoria",
    "/cumprimentos-procedentes",
    "/ops",
    "/supervisao",
    "/security",
    "/superadmin",
  ],
  financeiro: [
    "/crm",
    "/financas",
    "/report",
    "/calculos",
    "/analytics",
  ],
};

const ALWAYS = new Set([
  "/login",
  "/signup",
  "/settings",
  "/onboarding",
  "/termos",
]);

export function normalizePlanId(raw?: string | null): PlanId {
  const s = String(raw || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
  if (s === "maximo" || s === "max" || s === "enterprise" || s === "full") return "maximo";
  if (s === "operacional" || s === "ops") return "operacional";
  if (s === "financeiro" || s === "crm") return "financeiro";
  if (s === "essencial" || s === "base") return "essencial";
  return "maximo";
}

export function pacotesDoPlano(plan: PlanId): PacoteId[] {
  return PLAN_PACOTES[plan] || PLAN_PACOTES.maximo;
}

export function hrefLiberado(href: string, plan: PlanId): boolean {
  const path = (href.split("?")[0] || "/").replace(/\/+$/, "") || "/";
  if (ALWAYS.has(path) || path.startsWith("/settings")) return true;
  if (plan === "maximo") return true;
  const packs = pacotesDoPlano(plan);
  for (const pack of packs) {
    for (const p of PREFIX[pack]) {
      if (path === p || path.startsWith(p + "/")) return true;
    }
  }
  return false;
}

export function filterNavByPlan<T extends { href: string }>(items: T[], plan: PlanId): T[] {
  if (plan === "maximo") return items;
  return items.filter((i) => hrefLiberado(i.href, plan));
}


/** Ordem comercial: maior = mais completo. Operacional e Financeiro são paralelos. */
export function planRank(id: PlanId | string): number {
  const p = String(id || '').toLowerCase();
  if (p === 'maximo') return 100;
  if (p === 'operacional') return 50;
  if (p === 'financeiro') return 50;
  if (p === 'essencial') return 10;
  return 0;
}

/** true se candidate é inferior ou igual ao atual (não faz sentido “comprar” de novo). */
export function isPlanoInferiorOuIgual(atual: PlanId, candidate: PlanId): boolean {
  if (atual === 'maximo') return true; // máximo já tem tudo
  if (candidate === atual) return true;
  if (candidate === 'maximo') return false;
  // mesmos “tier” paralelo (op/fin) não é upgrade um do outro
  if (atual === 'operacional' && candidate === 'financeiro') return false;
  if (atual === 'financeiro' && candidate === 'operacional') return false;
  return planRank(candidate) <= planRank(atual);
}

/** Planos que ainda fazem sentido oferecer como upgrade. */
export function planosDisponiveisParaUpgrade(atual: PlanId): PlanId[] {
  if (atual === 'maximo') return [];
  return PLAN_IDS.filter((id) => !isPlanoInferiorOuIgual(atual, id) || id === 'maximo').filter(
    (id) => id !== atual
  );
}

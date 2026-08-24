export type DealStage = "lead" | "qualified" | "proposal" | "negotiation" | "won" | "lost";

export interface Company {
  id: string;
  name: string;
  domain?: string;
  industry?: string;
  employees?: string;
  city?: string;
  country?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Person {
  id: string;
  companyId?: string;
  name: string;
  email?: string;
  phone?: string;
  role?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Deal {
  id: string;
  companyId: string;
  name: string;
  amount: number;
  currency: string;
  stage: DealStage;
  closeDate?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Note {
  id: string;
  companyId?: string;
  personId?: string;
  dealId?: string;
  body: string;
  createdAt: string;
  author: string;
}

export const STAGE_LABEL: Record<DealStage, string> = {
  lead: "Lead",
  qualified: "Qualificado",
  proposal: "Proposta",
  negotiation: "Negociação",
  won: "Ganho",
  lost: "Perdido",
};

export const STAGE_COLOR: Record<DealStage, string> = {
  lead: "bg-slate-100 text-slate-700",
  qualified: "bg-sky-100 text-sky-800",
  proposal: "bg-violet-100 text-violet-800",
  negotiation: "bg-amber-100 text-amber-900",
  won: "bg-emerald-100 text-emerald-800",
  lost: "bg-rose-100 text-rose-800",
};

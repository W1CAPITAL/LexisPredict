import type { PlanId } from "@/lib/planos-pacotes";

export type PlanoPreco = {
  id: PlanId;
  valorMensal: number;
  /** Total no ano (já com desconto ≈ 2 meses) */
  valorAnual: number;
  destaque?: boolean;
  /** Selo curto no card (ex.: "Mais escolhido") */
  selo?: string;
  cta: string;
  /** Uma linha de posicionamento */
  tagline: string;
  beneficios: string[];
  /** O que NÃO inclui (transparência no card) */
  naoInclui?: string[];
};

/**
 * Preços comerciais LexisPredict (2026).
 * Anual = 10× o mensal (≈ 2 meses grátis).
 */
export const PLANOS_PRECOS: Record<PlanId, PlanoPreco> = {
  essencial: {
    id: "essencial",
    valorMensal: 197,
    valorAnual: 1970,
    cta: "Começar no Essencial",
    tagline: "Carteira e fila no dia a dia da banca.",
    beneficios: [
      "Painel com KPIs da carteira",
      "Processos, fila de tarefas e agenda",
      "Clientes, equipe e notas",
      "Importação CSV / planilha (leitura)",
      "Configurações e multi-usuário básico",
    ],
    naoInclui: ["Scanner DataJud/DJEN", "CRM/cobrança", "Cumprimentos e honorários"],
  },
  operacional: {
    id: "operacional",
    valorMensal: 397,
    valorAnual: 3970,
    destaque: true,
    selo: "Mais escolhido",
    cta: "Assinar Operacional",
    tagline: "Tribunal, cumprimento e motor de oportunidades.",
    beneficios: [
      "Tudo do Essencial",
      "Scanner DataJud + DJEN (fila e lote)",
      "DJEN revisional (processos reais + filtros)",
      "Cumprimentos procedentes e honorários a receber",
      "Busca e apreensão, processos parados, alertas",
      "Peças, veredito, automação judicial e IA de apoio",
      "WhatsApp operacional e supervisão",
    ],
    naoInclui: ["CRM completo e régua de cobrança"],
  },
  financeiro: {
    id: "financeiro",
    valorMensal: 297,
    valorAnual: 2970,
    cta: "Assinar Financeiro",
    tagline: "CRM, caixa e cobrança em cima da carteira.",
    beneficios: [
      "Tudo do Essencial",
      "CRM (funil, follow-ups, deals)",
      "Régua de cobrança e finanças",
      "Cálculos revisionais e dossiê",
      "Relatórios e analytics",
    ],
    naoInclui: ["Scanner DataJud/DJEN", "Cumprimentos / BA avançado"],
  },
  maximo: {
    id: "maximo",
    valorMensal: 597,
    valorAnual: 5970,
    destaque: true,
    selo: "Gabinete completo",
    cta: "Liberar Máximo",
    tagline: "Operacional + Financeiro sem bloqueio de módulo.",
    beneficios: [
      "Essencial + Operacional + Financeiro",
      "Scanner + DJEN revisional + enrichment (sua API)",
      "Cumprimentos, honorários, BA e CRM",
      "IA, peças, WhatsApp e supervisão",
      "Prioridade de suporte · ideal para 200–5.000 processos",
    ],
  },
};

/** Chave Pix da operação (recebedor). */
export const PIX_RECEBEDOR = {
  chave: "13988254651",
  nome: "W1 CAPITAL ASSESSORIA",
  cidade: "SAO PAULO",
} as const;

export function formatBRL(n: number) {
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/** Mensal equivalente quando paga o anual */
export function mensalDoAnual(plan: PlanId): number {
  const p = PLANOS_PRECOS[plan];
  return Math.round(p.valorAnual / 12);
}

/** Economia vs 12× mensal */
export function economiaAnual(plan: PlanId): number {
  const p = PLANOS_PRECOS[plan];
  return p.valorMensal * 12 - p.valorAnual;
}

export function valorCiclo(plan: PlanId, ciclo: "mensal" | "anual"): number {
  const p = PLANOS_PRECOS[plan];
  return ciclo === "mensal" ? p.valorMensal : p.valorAnual;
}

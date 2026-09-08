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
    tagline: "Carteira, fila e o básico do gabinete.",
    beneficios: [
      "Painel e KPIs da carteira",
      "Processos, fila e agenda",
      "Clientes, equipe e notas",
      "Importação de planilha",
      "Chat da equipe",
    ],
    naoInclui: ["Scanner DataJud/DJEN", "Gerador DJEN", "CRM e cobrança"],
  },
  operacional: {
    id: "operacional",
    valorMensal: 397,
    valorAnual: 3970,
    destaque: true,
    selo: "Mais escolhido",
    cta: "Assinar Operacional",
    tagline: "Tribunal, gerador de processos e o dia a dia da fila.",
    beneficios: [
      "Tudo do Essencial",
      "Scanner DataJud + DJEN",
      "Gerador de processos automáticos (intervalo + XLSX)",
      "Relatório da equipe em PDF",
      "Cumprimentos, BA, parados e alertas",
      "Peças, veredito, IA e WhatsApp",
      "Supervisão da carteira",
    ],
    naoInclui: ["CRM completo e régua de cobrança"],
  },
  financeiro: {
    id: "financeiro",
    valorMensal: 297,
    valorAnual: 2970,
    cta: "Assinar Financeiro",
    tagline: "CRM, caixa e dossiê em cima da carteira.",
    beneficios: [
      "Tudo do Essencial",
      "CRM (funil, follow-up, deals)",
      "Cobrança e finanças",
      "Cálculos e dossiê operacional",
      "Relatórios e analytics",
    ],
    naoInclui: ["Scanner DataJud/DJEN", "Gerador de processos"],
  },
  maximo: {
    id: "maximo",
    valorMensal: 597,
    valorAnual: 5970,
    destaque: true,
    selo: "Gabinete completo",
    cta: "Liberar Máximo",
    tagline: "Gabinete inteiro: tribunal, gerador, CRM e dossiê.",
    beneficios: [
      "Essencial + Operacional + Financeiro",
      "Gerador DJEN com intervalo e exportação",
      "Relatório da equipe + dossiê",
      "CRM, cobrança, BA e cumprimentos",
      "IA, peças, WhatsApp e supervisão",
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

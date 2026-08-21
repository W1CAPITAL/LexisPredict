/**
 * Tabela comercial dos planos LexisPredict.
 * Ajuste valores aqui — a UI e o Pix usam esta fonte única.
 */

import type { PlanId } from "@/lib/planos-pacotes";

export type PlanoPreco = {
  id: PlanId;
  valorMensal: number;
  valorAnual: number; // total no ano (com desconto)
  destaque?: boolean;
  cta: string;
  beneficios: string[];
};

export const PLANOS_PRECOS: Record<PlanId, PlanoPreco> = {
  essencial: {
    id: "essencial",
    valorMensal: 197,
    valorAnual: 1970, // ~2 meses grátis
    cta: "Começar no Essencial",
    beneficios: [
      "Painel e carteira de processos",
      "Fila de tarefas e atendimento",
      "Cadastro de clientes e equipe",
      "Importação CSV e configurações",
    ],
  },
  operacional: {
    id: "operacional",
    valorMensal: 397,
    valorAnual: 3970,
    destaque: true,
    cta: "Upgrade Operacional",
    beneficios: [
      "Tudo do Essencial",
      "Scanner DataJud + DJEN",
      "WhatsApp operacional",
      "Peças, parados e alertas",
      "Automação judicial e IA de apoio",
    ],
  },
  financeiro: {
    id: "financeiro",
    valorMensal: 297,
    valorAnual: 2970,
    cta: "Upgrade Financeiro",
    beneficios: [
      "Tudo do Essencial",
      "CRM e régua de cobrança",
      "Caixa e dossiê",
      "Relatórios financeiros",
    ],
  },
  maximo: {
    id: "maximo",
    valorMensal: 597,
    valorAnual: 5970,
    destaque: true,
    cta: "Liberar Máximo",
    beneficios: [
      "Essencial + Operacional + Financeiro",
      "Prioridade de suporte",
      "Todos os módulos sem bloqueio",
      "Ideal para assessoria com volume",
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

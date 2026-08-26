/**
 * Relatório de transparência mensal — mesmo sem movimentação.
 * Linguagem ética (CDC): nunca “fase final / causa ganha”.
 */

import { FASE_LABELS, type EstadoFluxoEtico } from "@/lib/fluxo-etico-fases";
import { auditarTextoEtica } from "@/lib/etica-frases-proibidas";

export type InputRelatorioTransparencia = {
  nomeCliente?: string;
  empresa?: string;
  protocolo?: string;
  periodoLabel?: string; // ex. "agosto/2026"
  houveMovimentacao: boolean;
  resumoMovimentacao?: string | null;
  fase?: EstadoFluxoEtico["fase"] | string | null;
  proximoPasso?: string | null;
};

export function gerarRelatorioTransparencia(input: InputRelatorioTransparencia): {
  texto: string;
  complianceOk: boolean;
  bloqueios: string[];
} {
  const nome = input.nomeCliente || "cliente";
  const empresa = input.empresa || "nossa equipe";
  const periodo = input.periodoLabel || mesAtualLabel();
  const fase =
    input.fase && input.fase in FASE_LABELS
      ? FASE_LABELS[input.fase as keyof typeof FASE_LABELS]
      : input.fase || "em acompanhamento conforme contrato";

  const mov = input.houveMovimentacao
    ? `Houve movimentação relevante:\n${(input.resumoMovimentacao || "Detalhes no processo/protocolo.").trim()}`
    : "Neste período não houve movimentação relevante no tribunal ou retorno formal do banco.";

  const proximo =
    input.proximoPasso?.trim() ||
    "Continuamos o acompanhamento e avisaremos objetivamente quando houver novidade — sem promessa de prazo de decisão.";

  const texto = [
    `Relatório de transparência — ${periodo}`,
    ``,
    `Olá, ${nome}. Aqui é a ${empresa}.`,
    input.protocolo ? `Referência: ${input.protocolo}` : null,
    `Fase contratual atual: ${fase}.`,
    ``,
    mov,
    ``,
    `Próximo passo: ${proximo}`,
    ``,
    `Lembrete: não há garantia de resultado judicial. Qualquer mudança de via (ex.: extrajudicial → judicial) só ocorre com seu consentimento escrito e ciência de custos/riscos.`,
    ``,
    `Qualquer dúvida, responda esta mensagem.`,
  ]
    .filter((l) => l !== null)
    .join("\n");

  const audit = auditarTextoEtica(texto);
  return {
    texto,
    complianceOk: audit.ok,
    bloqueios: audit.bloqueios.map((b) => b.motivo),
  };
}

function mesAtualLabel(): string {
  try {
    return new Date().toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  } catch {
    return "período atual";
  }
}

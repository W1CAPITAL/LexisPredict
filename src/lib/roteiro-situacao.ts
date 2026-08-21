/**
 * Roteiro por situação → tipo de peça / ação.
 * Inspirado em: rogeriotravagin/escritorio-ia (mapa situação → comando)
 *
 * Não gera a peça — só direciona o operador no Lexis.
 */

export type SituacaoRoteiro = {
  id: string;
  label: string;
  area: "civel" | "criminal" | "empresarial" | "geral";
  acaoSugerida: string;
  pecaSugerida?: string;
  checklist: string[];
};

export const ROTEIROS: SituacaoRoteiro[] = [
  {
    id: "ba-risco",
    label: "Risco de busca e apreensão",
    area: "civel",
    acaoSugerida: "Contatar cliente imediatamente + orientar regularização",
    pecaSugerida: "Petição de depósito / pedido de prazo",
    checklist: [
      "Confirmar andamento no DataJud/DJEN",
      "Ligar/WhatsApp ao cliente hoje",
      "Verificar proposta de acordo ou depósito",
      "Registrar atendimento na Fila",
    ],
  },
  {
    id: "silencio-45",
    label: "Silêncio no tribunal > 45 dias",
    area: "geral",
    acaoSugerida: "Verificar paralisação e cabimento de provocação",
    checklist: [
      "Scan pontual do CNJ",
      "Checar se há pendência de cumprimento de despacho",
      "Avaliar petição de andamento",
      "Atualizar status na carteira",
    ],
  },
  {
    id: "replica-pendente",
    label: "Réplica pendente",
    area: "civel",
    acaoSugerida: "Prazo de réplica — priorizar peça",
    pecaSugerida: "Réplica",
    checklist: [
      "Conferir prazo no tribunal",
      "Reunir documentos do cliente",
      "Gerar minuta e revisar",
      "Protocolar e marcar retorno",
    ],
  },
  {
    id: "sentenca-favoravel",
    label: "Sentença / decisão favorável",
    area: "geral",
    acaoSugerida: "Comunicar cliente + avaliar cumprimento ou recurso adverso",
    checklist: [
      "Ler teor completo",
      "Simplificar resumo para o cliente",
      "Orientar próximos passos",
      "Agendar follow-up",
    ],
  },
  {
    id: "sem-retorno-cliente",
    label: "Cliente sem retorno",
    area: "geral",
    acaoSugerida: "Régua de contato (WhatsApp → ligação → e-mail)",
    checklist: [
      "Enviar WhatsApp com resumo claro",
      "Registrar tentativa",
      "Se 3ª tentativa, escalar supervisor",
    ],
  },
];

export function sugerirRoteiro(sinais: {
  temBuscaApreensao?: boolean;
  silencio45?: boolean;
  replicaPendente?: boolean;
  temMerito?: boolean;
  semRetornoCliente?: boolean;
}): SituacaoRoteiro | null {
  if (sinais.temBuscaApreensao) return ROTEIROS.find((r) => r.id === "ba-risco") || null;
  if (sinais.replicaPendente) return ROTEIROS.find((r) => r.id === "replica-pendente") || null;
  if (sinais.temMerito) return ROTEIROS.find((r) => r.id === "sentenca-favoravel") || null;
  if (sinais.silencio45) return ROTEIROS.find((r) => r.id === "silencio-45") || null;
  if (sinais.semRetornoCliente) return ROTEIROS.find((r) => r.id === "sem-retorno-cliente") || null;
  return null;
}

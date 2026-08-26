/**
 * Timeline art. 523 CPC — inspirada no fluxo operacional de calculadoras
 * de cumprimento (ex.: Legalcloud) e no controle de fase dos CRMs jurídicos.
 *
 * Não inventa datas: só usa o que estiver no caso / teor / dados.
 * Se não houver intimação, marca etapa como "pendente de prova".
 */

export type Etapa523Status = "ok" | "ativo" | "pendente" | "bloqueado" | "na";

export type Etapa523 = {
  id: string;
  label: string;
  status: Etapa523Status;
  detalhe?: string;
  /** ISO se conhecido */
  data?: string | null;
};

export type Timeline523Input = {
  dataTransito?: string | null;
  dataSentenca?: string | null;
  /** intimação para pagamento voluntário (se conhecida) */
  dataIntimacaoPagamento?: string | null;
  emCumprimento?: boolean;
  cumprimentoEncerrado?: boolean;
  /** motor detectou art. 523 no teor */
  temArt523NoTeor?: boolean;
  prazoVoluntarioDias?: number; // default 15
};

function parseD(d?: string | null): Date | null {
  if (!d) return null;
  const x = new Date(d);
  return Number.isNaN(x.getTime()) ? null : x;
}

function addDays(d: Date, n: number): Date {
  const x = new Date(d.getTime());
  x.setDate(x.getDate() + n);
  return x;
}

function fmt(d: Date): string {
  return d.toLocaleDateString("pt-BR");
}

/**
 * Monta esteira: trânsito → intimação 523 → prazo 15d → multa/hon → atos executivos.
 */
export function montarTimelineArt523(input: Timeline523Input): Etapa523[] {
  const prazo = input.prazoVoluntarioDias ?? 15;
  const transito = parseD(input.dataTransito);
  const intimacao = parseD(input.dataIntimacaoPagamento);
  const hoje = new Date();

  const etapas: Etapa523[] = [];

  // 1. Título executivo (trânsito / sentença)
  if (transito) {
    etapas.push({
      id: "transito",
      label: "Trânsito / título executivo",
      status: "ok",
      data: input.dataTransito,
      detalhe: fmt(transito),
    });
  } else if (input.dataSentenca) {
    etapas.push({
      id: "sentenca",
      label: "Sentença (trânsito não informado)",
      status: "pendente",
      data: input.dataSentenca,
      detalhe: "Confirmar trânsito em julgado",
    });
  } else {
    etapas.push({
      id: "titulo",
      label: "Título executivo",
      status: "pendente",
      detalhe: "Sem data de trânsito/sentença no cadastro",
    });
  }

  // 2. Intimação para pagamento voluntário
  if (intimacao) {
    etapas.push({
      id: "intimacao",
      label: "Intimação p/ pagamento (art. 523)",
      status: "ok",
      data: input.dataIntimacaoPagamento,
      detalhe: fmt(intimacao),
    });
  } else {
    etapas.push({
      id: "intimacao",
      label: "Intimação p/ pagamento (art. 523)",
      status: input.temArt523NoTeor ? "pendente" : "na",
      detalhe: input.temArt523NoTeor
        ? "Teor cita art. 523 — data de intimação não cadastrada"
        : "Sem intimação registrada (não inventar data)",
    });
  }

  // 3. Prazo voluntário
  if (intimacao) {
    const fim = addDays(intimacao, prazo);
    const esgotado = hoje > fim;
    etapas.push({
      id: "prazo_voluntario",
      label: `Prazo voluntário (${prazo} dias)`,
      status: esgotado ? "ok" : "ativo",
      data: fim.toISOString().slice(0, 10),
      detalhe: esgotado ? `Esgotado em ${fmt(fim)}` : `Vence em ${fmt(fim)}`,
    });

    // 4. Multa + honorários 10%
    etapas.push({
      id: "multa_hon",
      label: "Multa 10% + hon. 10% (art. 523 §1º)",
      status: esgotado ? (input.emCumprimento ? "ativo" : "ok") : "pendente",
      detalhe: esgotado
        ? "Prazo esgotado — cabível se não houve pagamento integral"
        : "Só após esgotar o prazo voluntário",
    });
  } else {
    etapas.push({
      id: "prazo_voluntario",
      label: `Prazo voluntário (${prazo} dias)`,
      status: "pendente",
      detalhe: "Depende da data de intimação",
    });
    etapas.push({
      id: "multa_hon",
      label: "Multa 10% + hon. 10% (art. 523 §1º)",
      status: "pendente",
      detalhe: "Sem intimação — não presumir multa",
    });
  }

  // 5. Cumprimento / atos
  if (input.cumprimentoEncerrado) {
    etapas.push({
      id: "atos",
      label: "Cumprimento / atos executivos",
      status: "ok",
      detalhe: "Encerrado no cadastro",
    });
  } else if (input.emCumprimento) {
    etapas.push({
      id: "atos",
      label: "Cumprimento / atos executivos",
      status: "ativo",
      detalhe: "Em cumprimento de sentença",
    });
  } else {
    etapas.push({
      id: "atos",
      label: "Instauração / atos executivos",
      status: "pendente",
      detalhe: "Ainda não instaurado (ou não sinalizado)",
    });
  }

  return etapas;
}

/** Extrai sinais de intimação/art.523 dos dados do caso sem inventar. */
export function sinaisArt523DoCaso(c: any): Timeline523Input {
  const d = c?.dados && typeof c.dados === "object" ? c.dados : {};
  return {
    dataTransito: c?.data_transito_julgado || d.data_transito_julgado || null,
    dataSentenca: c?.data_sentenca || d.data_sentenca || null,
    dataIntimacaoPagamento:
      d.data_intimacao_pagamento ||
      d.intimacao_art523 ||
      c?.data_intimacao_pagamento ||
      null,
    emCumprimento: !!(c?.em_cumprimento_sentenca || d.em_cumprimento_sentenca || c?.cumprimento_ativo),
    cumprimentoEncerrado: !!(c?.cumprimento_encerrado || d.cumprimento_encerrado),
    temArt523NoTeor: !!(d.art523 || d.credito_sentenca?.art523 || c?.art523),
  };
}

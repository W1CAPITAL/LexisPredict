/**
 * Diagnóstico contratual ético — taxa do contrato × referência BACEN (input humano).
 * Nunca inventa % de êxito judicial.
 */

export type DiagnosticoContrato = {
  /** taxa efetiva anual do contrato (% a.a.) — digitada ou extraída */
  taxaContratoAa: number | null;
  /** média BACEN na data da contratação (% a.a.) — digitada pelo operador */
  taxaMediaBacenAa: number | null;
  dataContratacao?: string | null;
  tipoProduto?: string | null; // veiculo, consignado, cartao…
  pontosAtencao: string[];
  /** texto de parecer SEM garantia de êxito */
  parecer: string;
  /** estimativa qualitativa apenas (não %) */
  indicioAbusividade: "baixo" | "moderado" | "alto" | "indefinido";
  updatedAt?: string;
};

export function emptyDiagnostico(): DiagnosticoContrato {
  return {
    taxaContratoAa: null,
    taxaMediaBacenAa: null,
    dataContratacao: null,
    tipoProduto: null,
    pontosAtencao: [],
    parecer: "",
    indicioAbusividade: "indefinido",
  };
}

export function calcularDiagnostico(input: {
  taxaContratoAa?: number | null;
  taxaMediaBacenAa?: number | null;
  dataContratacao?: string | null;
  tipoProduto?: string | null;
  pontosAtencao?: string[];
}): DiagnosticoContrato {
  const taxa = num(input.taxaContratoAa);
  const bacen = num(input.taxaMediaBacenAa);
  let indicio: DiagnosticoContrato["indicioAbusividade"] = "indefinido";
  const pontos = [...(input.pontosAtencao || [])];

  if (taxa != null && bacen != null && bacen > 0) {
    const ratio = taxa / bacen;
    if (ratio >= 2) {
      indicio = "alto";
      pontos.push(`Taxa do contrato (~${taxa}% a.a.) muito acima da média BACEN informada (~${bacen}% a.a.).`);
    } else if (ratio >= 1.35) {
      indicio = "moderado";
      pontos.push(`Taxa do contrato (~${taxa}% a.a.) acima da média BACEN informada (~${bacen}% a.a.).`);
    } else {
      indicio = "baixo";
      pontos.push(`Taxa próxima ou abaixo da média BACEN informada — abusividade por taxa é menos evidente.`);
    }
  } else {
    pontos.push("Informe taxa do contrato e média BACEN da data da contratação para comparar.");
  }

  const parecer = [
    "Parecer técnico preliminar (não é garantia de êxito judicial).",
    taxa != null ? `Taxa efetiva informada do contrato: ${taxa}% a.a.` : "Taxa do contrato: não informada.",
    bacen != null ? `Média BACEN de referência informada: ${bacen}% a.a.` : "Média BACEN: não informada.",
    input.dataContratacao ? `Data da contratação: ${input.dataContratacao}.` : null,
    input.tipoProduto ? `Produto: ${input.tipoProduto}.` : null,
    `Indício qualitativo de atenção quanto à taxa: ${indicio}.`,
    "A decisão de seguir só extrajudicial ou, depois, judicial, é do cliente, com termo de ciência de riscos.",
  ]
    .filter(Boolean)
    .join(" ");

  return {
    taxaContratoAa: taxa,
    taxaMediaBacenAa: bacen,
    dataContratacao: input.dataContratacao || null,
    tipoProduto: input.tipoProduto || null,
    pontosAtencao: [...new Set(pontos)].slice(0, 8),
    parecer,
    indicioAbusividade: indicio,
    updatedAt: new Date().toISOString(),
  };
}

function num(v: unknown): number | null {
  if (v == null || v === "") return null;
  const x = typeof v === "number" ? v : parseFloat(String(v).replace(",", "."));
  return Number.isFinite(x) && x > 0 ? x : null;
}

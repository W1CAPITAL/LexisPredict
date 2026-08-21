/**
 * Funil processual e KPIs de carteira.
 * Inspirado em: veredicta (funil Entrada→Encerramento) + padrões de data-analysis-queries
 */

export type FaseFunil =
  | "entrada"
  | "triagem"
  | "instrucao"
  | "decisao"
  | "cumprimento"
  | "encerrado";

export type CasoFunil = {
  id: string;
  fase: FaseFunil;
  valorCausa?: number | null;
  diasNaFase?: number;
};

export type FunilResumo = {
  porFase: Record<FaseFunil, number>;
  total: number;
  taxaEncerramento: number; // 0–1
  exposicaoTotal: number;
  backlogCritico: number; // diasNaFase > 60 em fases ativas
};

const FASES: FaseFunil[] = [
  "entrada",
  "triagem",
  "instrucao",
  "decisao",
  "cumprimento",
  "encerrado",
];

export function resumirFunil(casos: CasoFunil[]): FunilResumo {
  const porFase = Object.fromEntries(FASES.map((f) => [f, 0])) as Record<FaseFunil, number>;
  let exposicaoTotal = 0;
  let backlogCritico = 0;

  for (const c of casos) {
    porFase[c.fase] = (porFase[c.fase] || 0) + 1;
    if (c.fase !== "encerrado") {
      exposicaoTotal += Number(c.valorCausa || 0);
      if ((c.diasNaFase || 0) > 60) backlogCritico += 1;
    }
  }

  const total = casos.length || 1;
  const taxaEncerramento = (porFase.encerrado || 0) / total;

  return { porFase, total: casos.length, taxaEncerramento, exposicaoTotal, backlogCritico };
}

/** Mapeia strings de fase do Lexis para o funil. */
export function mapearFaseLexis(faseRaw?: string): FaseFunil {
  const f = String(faseRaw || "").toLowerCase();
  if (/encerr|baix|tr[aâ]nsito|arquiv/.test(f)) return "encerrado";
  if (/cumprimento|execu[cç][aã]o|pagament/.test(f)) return "cumprimento";
  if (/senten[cç]a|ac[oó]rd[aã]o|decis[aã]o/.test(f)) return "decisao";
  if (/instru[cç]|audi[eê]ncia|prova|per[ií]cia/.test(f)) return "instrucao";
  if (/contest|cita[cç]|triagem|inicial/.test(f)) return "triagem";
  return "entrada";
}

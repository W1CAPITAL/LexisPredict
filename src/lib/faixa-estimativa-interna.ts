/**
 * Faixa estimativa INTERNA (admin) — técnica de “pipeline revenue” dos CRMs,
 * aplicada a sucumbência sem prometer valor ao cliente.
 *
 * Só calcula se houver base no teor ou input humano.
 * Nunca exibir no WhatsApp / portal do cliente.
 */

export type FaixaEstimativa = {
  disponivel: boolean;
  motivo?: string;
  /** valor base usado (principal ou causa) */
  base: number | null;
  pctMin: number;
  pctMax: number;
  faixaMin: number | null;
  faixaMax: number | null;
  /** se art. 523 aplicável sobre a mesma base (só referência) */
  art523ExtraMin: number | null;
  art523ExtraMax: number | null;
  label: string;
};

function n(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v) && v > 0) return v;
  if (typeof v === "string") {
    const x = parseFloat(v.replace(/\./g, "").replace(",", "."));
    if (Number.isFinite(x) && x > 0) return x;
  }
  return null;
}

/**
 * @param baseValor valor principal/condenação/causa detectado ou digitado
 * @param pctHonorarios percentual do teor (ex.: 10) ou null → usa 10–20 art. 85
 */
export function estimarFaixaHonorariosInterna(opts: {
  baseValor?: number | string | null;
  pctHonorarios?: number | null;
  aplicarArt523Referencia?: boolean;
}): FaixaEstimativa {
  const base = n(opts.baseValor ?? null);
  if (base == null) {
    return {
      disponivel: false,
      motivo: "Sem valor-base no teor/cadastro — não estimar",
      base: null,
      pctMin: 10,
      pctMax: 20,
      faixaMin: null,
      faixaMax: null,
      art523ExtraMin: null,
      art523ExtraMax: null,
      label: "Indisponível",
    };
  }

  let pctMin = 10;
  let pctMax = 20;
  if (opts.pctHonorarios != null && opts.pctHonorarios > 0 && opts.pctHonorarios <= 30) {
    pctMin = opts.pctHonorarios;
    pctMax = opts.pctHonorarios;
  }

  const faixaMin = Math.round(base * (pctMin / 100) * 100) / 100;
  const faixaMax = Math.round(base * (pctMax / 100) * 100) / 100;

  let art523ExtraMin: number | null = null;
  let art523ExtraMax: number | null = null;
  if (opts.aplicarArt523Referencia) {
    // multa 10% + hon 10% sobre base (referência interna)
    art523ExtraMin = Math.round(base * 0.2 * 100) / 100;
    art523ExtraMax = art523ExtraMin;
  }

  const label =
    pctMin === pctMax
      ? `Hon. ~${pctMin}% sobre base (interno)`
      : `Hon. ${pctMin}–${pctMax}% art. 85 (interno)`;

  return {
    disponivel: true,
    base,
    pctMin,
    pctMax,
    faixaMin,
    faixaMax,
    art523ExtraMin,
    art523ExtraMax,
    label,
  };
}

export function formatFaixaBRL(f: FaixaEstimativa): string {
  if (!f.disponivel || f.faixaMin == null || f.faixaMax == null) return "—";
  const a = f.faixaMin.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const b = f.faixaMax.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  if (f.faixaMin === f.faixaMax) return a;
  return `${a} – ${b}`;
}

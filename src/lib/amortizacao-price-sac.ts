/**
 * Tabela Price (Sistema Francês) e SAC — triagem operacional.
 * Não substitui planilha de contadoria / perícia oficial.
 */

export type SistemaAmort = 'PRICE' | 'SAC';

export type ParcelaCronograma = {
  n: number;
  prestacao: number;
  juros: number;
  amortizacao: number;
  saldoApos: number;
};

export type CronogramaResultado = {
  sistema: SistemaAmort;
  valorFinanciado: number;
  taxaMensalPct: number;
  nParcelas: number;
  prestacaoFixa?: number; // Price
  totalPago: number;
  totalJuros: number;
  parcelas: ParcelaCronograma[];
  avisos: string[];
};

function money(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/** Prestação Price: PMT = PV * i / (1 - (1+i)^-n) */
export function prestacaoPrice(pv: number, taxaMensalPct: number, n: number): number {
  if (n <= 0 || pv <= 0) return 0;
  const i = taxaMensalPct / 100;
  if (i === 0) return money(pv / n);
  const pmt = (pv * i) / (1 - Math.pow(1 + i, -n));
  return money(pmt);
}

export function gerarCronogramaPrice(
  valorFinanciado: number,
  taxaMensalPct: number,
  nParcelas: number
): CronogramaResultado {
  const avisos = [
    'Tabela Price (parcelas fixas). Triagem — confira com o CET e a planilha do contrato.',
  ];
  const pmt = prestacaoPrice(valorFinanciado, taxaMensalPct, nParcelas);
  const i = taxaMensalPct / 100;
  let saldo = valorFinanciado;
  const parcelas: ParcelaCronograma[] = [];
  let totalJuros = 0;
  for (let k = 1; k <= nParcelas; k++) {
    const juros = money(saldo * i);
    let amort = money(pmt - juros);
    if (k === nParcelas) amort = money(saldo);
    const prest = k === nParcelas ? money(amort + juros) : pmt;
    saldo = money(Math.max(0, saldo - amort));
    totalJuros += juros;
    parcelas.push({ n: k, prestacao: prest, juros, amortizacao: amort, saldoApos: saldo });
  }
  return {
    sistema: 'PRICE',
    valorFinanciado,
    taxaMensalPct,
    nParcelas,
    prestacaoFixa: pmt,
    totalPago: money(parcelas.reduce((s, p) => s + p.prestacao, 0)),
    totalJuros: money(totalJuros),
    parcelas,
    avisos,
  };
}

export function gerarCronogramaSac(
  valorFinanciado: number,
  taxaMensalPct: number,
  nParcelas: number
): CronogramaResultado {
  const avisos = [
    'SAC (amortização constante, prestações decrescentes). Triagem operacional.',
  ];
  const i = taxaMensalPct / 100;
  const amortFixa = money(valorFinanciado / nParcelas);
  let saldo = valorFinanciado;
  const parcelas: ParcelaCronograma[] = [];
  let totalJuros = 0;
  for (let k = 1; k <= nParcelas; k++) {
    const juros = money(saldo * i);
    const amort = k === nParcelas ? money(saldo) : amortFixa;
    const prest = money(amort + juros);
    saldo = money(Math.max(0, saldo - amort));
    totalJuros += juros;
    parcelas.push({ n: k, prestacao: prest, juros, amortizacao: amort, saldoApos: saldo });
  }
  return {
    sistema: 'SAC',
    valorFinanciado,
    taxaMensalPct,
    nParcelas,
    totalPago: money(parcelas.reduce((s, p) => s + p.prestacao, 0)),
    totalJuros: money(totalJuros),
    parcelas,
    avisos,
  };
}

export function gerarCronograma(
  sistema: SistemaAmort,
  valorFinanciado: number,
  taxaMensalPct: number,
  nParcelas: number
): CronogramaResultado {
  return sistema === 'SAC'
    ? gerarCronogramaSac(valorFinanciado, taxaMensalPct, nParcelas)
    : gerarCronogramaPrice(valorFinanciado, taxaMensalPct, nParcelas);
}

/**
 * Recalcula o mesmo financiamento com taxa média (ex.: Bacen) e compara custo.
 */
export function compararTaxaContratoVsMedia(opts: {
  sistema: SistemaAmort;
  valorFinanciado: number;
  taxaContratoPct: number;
  taxaMediaBacenPct: number;
  nParcelas: number;
  /** Limiar jurisprudencial operacional (STJ / rotina estadual comum) */
  multiplicadorAbusividade?: number;
}): {
  contrato: CronogramaResultado;
  media: CronogramaResultado;
  diferencaTotalPago: number;
  razaoTaxas: number;
  sinalizaAbusividadeOperacional: boolean;
  limiar: number;
  avisos: string[];
} {
  const mult = opts.multiplicadorAbusividade ?? 1.5;
  const contrato = gerarCronograma(
    opts.sistema,
    opts.valorFinanciado,
    opts.taxaContratoPct,
    opts.nParcelas
  );
  const media = gerarCronograma(
    opts.sistema,
    opts.valorFinanciado,
    opts.taxaMediaBacenPct,
    opts.nParcelas
  );
  const razao =
    opts.taxaMediaBacenPct > 0 ? opts.taxaContratoPct / opts.taxaMediaBacenPct : 0;
  const limiar = opts.taxaMediaBacenPct * mult;
  const sinaliza = opts.taxaContratoPct > limiar;
  const avisos = [
    ...contrato.avisos,
    'Comparativo com média Bacen é triagem. STJ: superação de 1,5× a média não é presunção absoluta de abusividade (risco do tomador, spread, etc.).',
    'Súmula 596 STF / 382 STJ: instituições do SFN não se sujeitam ao teto de 12% a.a. da Lei de Usura.',
  ];
  return {
    contrato,
    media,
    diferencaTotalPago: money(contrato.totalPago - media.totalPago),
    razaoTaxas: Math.round(razao * 100) / 100,
    sinalizaAbusividadeOperacional: sinaliza,
    limiar: money(limiar),
    avisos,
  };
}

export function formatBRL(n: number): string {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

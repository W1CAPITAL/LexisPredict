/**
 * Motor de cálculos judiciais (estilo JusCalc) — LexisPredict.
 * Correção monetária por fatores mensais + juros simples + multa + honorários + custas − abatimentos.
 * Índices: fatores aproximados embutidos (média histórica) para operação offline;
 * substitua por série oficial (BCB/SGS) quando integrar API.
 */

export type IndiceCodigo = 'IPCA' | 'INPC' | 'IGPM' | 'SELIC' | 'CDI' | 'TR' | 'TJSP' | 'NENHUM';

export type ParcelaInput = {
  id?: string;
  descricao?: string;
  valor: number;
  /** YYYY-MM-DD */
  data: string;
};

export type JurosConfig = {
  /** % ao mês (ex.: 1 = 1% a.m.) */
  taxaMensalPct: number;
  /** YYYY-MM-DD início da mora */
  dataInicio: string;
  proRata?: boolean;
};

export type MultaConfig = {
  percentual: number;
  /** Se true, base = principalCorrigido + juros */
  sobreJuros?: boolean;
};

export type HonorariosConfig = {
  percentual: number;
  /** base do % */
  base: 'subtotal' | 'principal_corrigido' | 'fixo';
  valorFixo?: number;
};

export type CustaInput = {
  valor: number;
  data: string;
  descricao?: string;
};

export type AbatimentoInput = {
  valor: number;
  data: string;
  descricao?: string;
};

export type CalculoInput = {
  nome?: string;
  parcelas: ParcelaInput[];
  indice: IndiceCodigo;
  /** Data final YYYY-MM-DD (padrão: hoje) */
  dataFinal?: string;
  juros?: JurosConfig | null;
  multa?: MultaConfig | null;
  honorarios?: HonorariosConfig | null;
  /** Multa + honorários art. 523 (10%+10%) */
  art523?: boolean;
  custas?: CustaInput[];
  abatimentos?: AbatimentoInput[];
};

export type LinhaMemoria = {
  tipo: string;
  descricao: string;
  dataRef: string;
  valorOriginal: number;
  fatorCorrecao: number;
  valorCorrigido: number;
  juros: number;
  total: number;
};

export type CalculoResultado = {
  nome: string;
  dataFinal: string;
  indice: IndiceCodigo;
  linhas: LinhaMemoria[];
  principalOriginal: number;
  principalCorrigido: number;
  totalJuros: number;
  subtotal: number;
  multa: number;
  honorarios: number;
  multa523: number;
  honorarios523: number;
  custas: number;
  abatimentos: number;
  totalGeral: number;
  avisos: string[];
};

/** Fator mensal aproximado (1 + taxa). Não substitui série oficial. */
const FATOR_MENSAL_APROX: Record<string, number> = {
  IPCA: 1.0045,
  INPC: 1.0042,
  IGPM: 1.0055,
  SELIC: 1.009,
  CDI: 1.0088,
  TR: 1.001,
  TJSP: 1.0048, // aprox. Tabela Prática TJSP (média)
};

function parseDate(s: string): Date {
  const [y, m, d] = String(s).slice(0, 10).split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

function fmtDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function monthsBetween(a: Date, b: Date): { full: number; frac: number } {
  if (b <= a) return { full: 0, frac: 0 };
  let months =
    (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth());
  const dayStart = a.getDate();
  const dayEnd = b.getDate();
  let frac = 0;
  if (dayEnd < dayStart) {
    months -= 1;
    const daysInPrev = new Date(b.getFullYear(), b.getMonth(), 0).getDate();
    frac = (daysInPrev - dayStart + dayEnd) / daysInPrev;
  } else if (dayEnd > dayStart) {
    const daysIn = new Date(b.getFullYear(), b.getMonth() + 1, 0).getDate();
    frac = (dayEnd - dayStart) / daysIn;
  }
  if (months < 0) return { full: 0, frac: 0 };
  return { full: months, frac: Math.max(0, Math.min(1, frac)) };
}

export function fatorCorrecao(
  indice: IndiceCodigo,
  dataInicio: string,
  dataFim: string,
  proRata = true
): number {
  if (indice === 'NENHUM') return 1;
  const a = parseDate(dataInicio);
  const b = parseDate(dataFim);
  const { full, frac } = monthsBetween(a, b);
  const fm = FATOR_MENSAL_APROX[indice] || 1;
  const base = Math.pow(fm, full);
  if (!proRata || frac <= 0) return base;
  return base * Math.pow(fm, frac);
}

export function jurosSimples(
  valorCorrigido: number,
  taxaMensalPct: number,
  dataInicio: string,
  dataFim: string,
  proRata = true
): number {
  if (!taxaMensalPct || valorCorrigido <= 0) return 0;
  const { full, frac } = monthsBetween(parseDate(dataInicio), parseDate(dataFim));
  const meses = full + (proRata ? frac : 0);
  if (meses <= 0) return 0;
  return valorCorrigido * (taxaMensalPct / 100) * meses;
}

function money(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/**
 * Executa o cálculo completo no estilo JusCalc (ordem operacional padrão).
 */
export function executarCalculoJudicial(input: CalculoInput): CalculoResultado {
  const avisos: string[] = [
    'Índices usam fator mensal aproximado embutido (não são série oficial BCB). Use o resultado como triagem; para petição formal, confira com contadoria/índice da sentença.',
  ];
  const dataFinal = input.dataFinal || fmtDate(new Date());
  const linhas: LinhaMemoria[] = [];
  let principalOriginal = 0;
  let principalCorrigido = 0;
  let totalJuros = 0;

  for (const p of input.parcelas || []) {
    const valor = Number(p.valor) || 0;
    if (valor <= 0 || !p.data) continue;
    const fat = fatorCorrecao(input.indice, p.data, dataFinal, true);
    const corrigido = money(valor * fat);
    let j = 0;
    if (input.juros && input.juros.taxaMensalPct > 0) {
      const ini = input.juros.dataInicio || p.data;
      j = money(
        jurosSimples(
          corrigido,
          input.juros.taxaMensalPct,
          ini,
          dataFinal,
          input.juros.proRata !== false
        )
      );
    }
    principalOriginal += valor;
    principalCorrigido += corrigido;
    totalJuros += j;
    linhas.push({
      tipo: 'parcela',
      descricao: p.descricao || 'Principal',
      dataRef: p.data,
      valorOriginal: money(valor),
      fatorCorrecao: money(fat),
      valorCorrigido: corrigido,
      juros: j,
      total: money(corrigido + j),
    });
  }

  principalOriginal = money(principalOriginal);
  principalCorrigido = money(principalCorrigido);
  totalJuros = money(totalJuros);
  const subtotal = money(principalCorrigido + totalJuros);

  let multa = 0;
  if (input.multa && input.multa.percentual > 0) {
    const base = input.multa.sobreJuros !== false ? subtotal : principalCorrigido;
    multa = money(base * (input.multa.percentual / 100));
    linhas.push({
      tipo: 'multa',
      descricao: `Multa ${input.multa.percentual}%`,
      dataRef: dataFinal,
      valorOriginal: 0,
      fatorCorrecao: 1,
      valorCorrigido: 0,
      juros: 0,
      total: multa,
    });
  }

  let honorarios = 0;
  if (input.honorarios) {
    if (input.honorarios.valorFixo && input.honorarios.valorFixo > 0) {
      honorarios = money(input.honorarios.valorFixo);
    } else if (input.honorarios.percentual > 0) {
      let base = subtotal;
      if (input.honorarios.base === 'principal_corrigido') base = principalCorrigido;
      if (input.honorarios.base === 'fixo') base = money(subtotal + multa);
      honorarios = money(base * (input.honorarios.percentual / 100));
    }
    if (honorarios > 0) {
      linhas.push({
        tipo: 'honorarios',
        descricao: `Honorários ${input.honorarios.percentual || ''}%`.trim(),
        dataRef: dataFinal,
        valorOriginal: 0,
        fatorCorrecao: 1,
        valorCorrigido: 0,
        juros: 0,
        total: honorarios,
      });
    }
  }

  let multa523 = 0;
  let honorarios523 = 0;
  if (input.art523) {
    const base523 = money(subtotal + multa);
    multa523 = money(base523 * 0.1);
    honorarios523 = money(base523 * 0.1);
    avisos.push('Art. 523 CPC: multa 10% + honorários 10% sobre débito (principal+juros+multa contratual/processual lançada). Confirme se o prazo de pagamento voluntário esgotou.');
    linhas.push({
      tipo: 'art523_multa',
      descricao: 'Multa art. 523 CPC 10%',
      dataRef: dataFinal,
      valorOriginal: 0,
      fatorCorrecao: 1,
      valorCorrigido: 0,
      juros: 0,
      total: multa523,
    });
    linhas.push({
      tipo: 'art523_hon',
      descricao: 'Honorários art. 523 CPC 10%',
      dataRef: dataFinal,
      valorOriginal: 0,
      fatorCorrecao: 1,
      valorCorrigido: 0,
      juros: 0,
      total: honorarios523,
    });
  }

  let custas = 0;
  for (const c of input.custas || []) {
    const v = Number(c.valor) || 0;
    if (v <= 0) continue;
    const fat = fatorCorrecao(input.indice, c.data || dataFinal, dataFinal, true);
    const corr = money(v * fat);
    custas += corr;
    linhas.push({
      tipo: 'custa',
      descricao: c.descricao || 'Custas',
      dataRef: c.data || dataFinal,
      valorOriginal: money(v),
      fatorCorrecao: money(fat),
      valorCorrigido: corr,
      juros: 0,
      total: corr,
    });
  }
  custas = money(custas);

  let abatimentos = 0;
  for (const a of input.abatimentos || []) {
    const v = Number(a.valor) || 0;
    if (v <= 0) continue;
    abatimentos += v;
    linhas.push({
      tipo: 'abatimento',
      descricao: a.descricao || 'Abatimento',
      dataRef: a.data || dataFinal,
      valorOriginal: money(v),
      fatorCorrecao: 1,
      valorCorrigido: money(v),
      juros: 0,
      total: -money(v),
    });
  }
  abatimentos = money(abatimentos);

  const totalGeral = money(
    subtotal + multa + honorarios + multa523 + honorarios523 + custas - abatimentos
  );

  return {
    nome: input.nome || 'Cálculo Lexis',
    dataFinal,
    indice: input.indice,
    linhas,
    principalOriginal,
    principalCorrigido,
    totalJuros,
    subtotal,
    multa,
    honorarios,
    multa523,
    honorarios523,
    custas,
    abatimentos,
    totalGeral,
    avisos,
  };
}

export function formatBRL(n: number): string {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

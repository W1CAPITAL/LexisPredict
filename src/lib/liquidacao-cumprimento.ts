/**
 * LexisPredict — Liquidação de Cumprimento (Lote 10)
 * Motor compatível com o fluxo da Calculadora Legalcloud (UI Premium),
 * SEM depender de API proprietária (Legalcloud não publica API de liquidação).
 *
 * Regras:
 * - NÃO inventa valor principal: só usa input humano ou valor detectado no teor (referência).
 * - Art. 523, §1º CPC: multa 10% + honorários 10% sobre o montante não pago no prazo.
 * - Art. 85 CPC: honorários de conhecimento (percentual do teor ou informado).
 * - Abatimentos / custas são informados pelo operador.
 * - Resultado é SIMULAÇÃO interna; hard block de R$ ao cliente permanece fora deste módulo.
 */

export type IndiceCorrecao = 'manual' | 'ipca' | 'inpc' | 'selic_proxy' | 'taxa_legal_proxy';

export type InputLiquidacao = {
  /** Valor principal líquido da condenação (obrigatório para calcular). */
  valorPrincipal: number;
  /** Data-base do valor (sentença / trânsito / último cálculo). ISO yyyy-mm-dd */
  dataBase?: string | null;
  /** Data do cálculo (hoje por padrão). */
  dataCalculo?: string | null;
  /** Fator de correção manual acumulado (ex.: 1.12 = +12%). Se omitido e índice=manual, =1. */
  fatorCorrecao?: number | null;
  /** Índice escolhido (proxy — operador valida no Legalcloud/tabela oficial). */
  indice?: IndiceCorrecao;
  /** Juros simples % a.a. (ex.: 12). Taxa legal = informar via fator/proxy. */
  jurosAaPercent?: number | null;
  /** Meses de juros (se omitido, estima por datas). */
  mesesJuros?: number | null;
  /** Pagamentos / abatimentos já feitos. */
  abatimentos?: number;
  /** Custas a reembolsar. */
  custas?: number;
  /** Honorários de conhecimento (art. 85) — percentual 0–20. */
  honorariosConhecimentoPct?: number | null;
  /** Se true, aplica multa 10% + hon. 10% do art. 523 §1º sobre saldo após prazo. */
  aplicarArt523?: boolean;
  /** Honorários do cumprimento já fixados em valor (opcional). */
  honorariosCumprimentoFixo?: number | null;
};

export type ResultadoLiquidacao = {
  ok: boolean;
  erros: string[];
  avisos: string[];
  principalCorrigido: number;
  juros: number;
  subtotal: number;
  abatimentos: number;
  custas: number;
  saldoBase: number;
  honorariosConhecimento: number;
  multa523: number;
  honorarios523: number;
  total: number;
  detalhe: {
    fatorCorrecao: number;
    mesesJuros: number;
    jurosAaPercent: number;
    honorariosConhecimentoPct: number;
    aplicouArt523: boolean;
  };
  /** Linhas para demonstrativo / export */
  linhas: { label: string; valor: number }[];
};

function n(v: unknown): number {
  const x = typeof v === 'number' ? v : parseFloat(String(v ?? '').replace(/\./g, '').replace(',', '.'));
  return Number.isFinite(x) ? x : 0;
}

function mesesEntre(a?: string | null, b?: string | null): number {
  if (!a || !b) return 0;
  try {
    const d0 = new Date(a);
    const d1 = new Date(b);
    if (Number.isNaN(d0.getTime()) || Number.isNaN(d1.getTime())) return 0;
    const m =
      (d1.getFullYear() - d0.getFullYear()) * 12 +
      (d1.getMonth() - d0.getMonth()) +
      (d1.getDate() >= d0.getDate() ? 0 : -1);
    return Math.max(0, m);
  } catch {
    return 0;
  }
}

/**
 * Simula liquidação no espírito da calculadora Legalcloud.
 * Índices oficiais (IPCA/SELIC/Taxa Legal) devem ser confirmados pelo operador
 * ou recalculados no app Legalcloud — aqui o fator é explícito/manual.
 */
export function simularLiquidacaoCumprimento(input: InputLiquidacao): ResultadoLiquidacao {
  const erros: string[] = [];
  const avisos: string[] = [];

  const principal = n(input.valorPrincipal);
  if (principal <= 0) {
    erros.push('Informe o valor principal (não inventado — teor ou digitação humana).');
  }

  let fator = n(input.fatorCorrecao);
  if (fator <= 0) fator = 1;
  if (input.indice && input.indice !== 'manual' && fator === 1) {
    avisos.push(
      `Índice "${input.indice}" selecionado sem fator — usando 1,0. Confirme correção no Legalcloud ou tabela oficial.`
    );
  }

  const dataCalc = input.dataCalculo || new Date().toISOString().slice(0, 10);
  let meses = input.mesesJuros != null ? Math.max(0, n(input.mesesJuros)) : mesesEntre(input.dataBase, dataCalc);
  const jurosAa = input.jurosAaPercent != null ? n(input.jurosAaPercent) : 0;
  if (jurosAa > 0 && meses === 0 && input.dataBase) {
    avisos.push('Juros % a.a. informado mas intervalo de meses = 0 — verifique data-base.');
  }

  const principalCorrigido = principal * fator;
  const juros = principalCorrigido * (jurosAa / 100) * (meses / 12);
  const subtotal = principalCorrigido + juros;
  const abatimentos = Math.max(0, n(input.abatimentos));
  const custas = Math.max(0, n(input.custas));
  const saldoBase = Math.max(0, subtotal - abatimentos) + custas;

  const pctHon =
    input.honorariosConhecimentoPct != null && input.honorariosConhecimentoPct > 0
      ? Math.min(30, n(input.honorariosConhecimentoPct))
      : 0;
  const honorariosConhecimento =
    pctHon > 0 ? saldoBase * (pctHon / 100) : Math.max(0, n(input.honorariosCumprimentoFixo));

  const aplicar523 = input.aplicarArt523 === true;
  let multa523 = 0;
  let honorarios523 = 0;
  if (aplicar523) {
    // Art. 523 §1º: multa de 10% e honorários de 10% sobre o montante do débito
    const base523 = saldoBase + honorariosConhecimento;
    multa523 = base523 * 0.1;
    honorarios523 = base523 * 0.1;
  }

  const total = saldoBase + honorariosConhecimento + multa523 + honorarios523;

  if (aplicar523) {
    avisos.push('Art. 523 §1º aplicado: multa 10% + honorários 10% (só se prazo de pagamento voluntário esgotado).');
  }

  const linhas: { label: string; valor: number }[] = [
    { label: 'Principal', valor: principal },
    { label: 'Principal corrigido', valor: principalCorrigido },
    { label: 'Juros', valor: juros },
    { label: 'Subtotal', valor: subtotal },
    { label: '(-) Abatimentos', valor: -abatimentos },
    { label: 'Custas', valor: custas },
    { label: 'Saldo base', valor: saldoBase },
    { label: 'Honorários conhecimento (art. 85)', valor: honorariosConhecimento },
  ];
  if (aplicar523) {
    linhas.push({ label: 'Multa art. 523 (10%)', valor: multa523 });
    linhas.push({ label: 'Honorários art. 523 (10%)', valor: honorarios523 });
  }
  linhas.push({ label: 'TOTAL SIMULADO', valor: total });

  return {
    ok: erros.length === 0,
    erros,
    avisos,
    principalCorrigido: round2(principalCorrigido),
    juros: round2(juros),
    subtotal: round2(subtotal),
    abatimentos: round2(abatimentos),
    custas: round2(custas),
    saldoBase: round2(saldoBase),
    honorariosConhecimento: round2(honorariosConhecimento),
    multa523: round2(multa523),
    honorarios523: round2(honorarios523),
    total: round2(total),
    detalhe: {
      fatorCorrecao: fator,
      mesesJuros: meses,
      jurosAaPercent: jurosAa,
      honorariosConhecimentoPct: pctHon,
      aplicouArt523: aplicar523,
    },
    linhas,
  };
}

function round2(x: number): number {
  return Math.round(x * 100) / 100;
}

/** Formata BRL só para UI interna (admin). */
export function formatBRL(v: number): string {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

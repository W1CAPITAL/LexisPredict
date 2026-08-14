/**
 * Score de oportunidade para instaurar cumprimento com viés de honorários.
 * Camada comercial em cima de cumprimento_pendente_necessario (base jurídica).
 *
 * Art. 523 §1º CPC + Súmula 517 STJ: após 15 dias sem pagamento voluntário,
 * multa 10% + honorários 10% sobre o valor do débito.
 *
 * Casos "ruins" (improcedente puro, sucumbência recíproca, só compensação)
 * NÃO entram como elegíveis para cobrar instaurar.
 */
export type TipoCreditoOportunidade = 'cliente' | 'sucumbencia' | 'ambos' | 'incerto';

export type OportunidadeInstaurarCumprimento = {
  elegivel: boolean;
  score: number;
  motivos: string[];
  riscos: string[];
  tipo_credito: TipoCreditoOportunidade;
  acima_limiar_cobranca: boolean;
  confianca_analise: number;
  dias_apos_transito: number | null;
  requer_revisao_humana: boolean;
};

export type InputOportunidade = {
  is_procedente: boolean;
  merito_tipo?: 'procedente' | 'parcial' | 'improcedente' | null;
  cumprimento_pendente_necessario: boolean;
  em_cumprimento_sentenca: boolean;
  cumprimento_encerrado: boolean;
  cumprimento_ativo?: boolean;
  confianca?: number;
  dias_apos_transito?: number | null;
  transito_fonte?: string | null;
  declaratorio_sem_quantia?: boolean;
  ativo_forte?: boolean;
  blob?: string | null;
  parte_passiva?: string | null;
};

const LIMIAR_COBRANCA = 55;
const LIMIAR_CONFIANCA_MIN = 60;
const LIMIAR_REVISAO_HUMANA = 75;

/** Condenação em quantia / restituição / indenização */
const QUANTIA_POS =
  /CONDENO\s+A\s+PAGAR|OBRIGAÇÃO\s+DE\s+PAGAR|OBRIGACAO\s+DE\s+PAGAR|RESTITUI[CÇ][AÃ]O|DEVOLU[CÇ][AÃ]O|INDENIZA[CÇ][AÃ]O|R\$\s*\d|VALOR\s+DE\s+R\$|CUSTAS\s+E\s+HONOR[AÁ]RIOS|PAGAR\s+O\s+VALOR|CONDENAÇÃO\s+EM\s+QUANTIA|CONDENACAO\s+EM\s+QUANTIA|REPETIÇÃO\s+DE\s+IND[EÉ]BITO|REPETICAO\s+DE\s+INDEBITO|OBRIGADO\s+O\s+R[EÉ]U\s+A\s+PAGAR/i;

/**
 * Honorários de sucumbência com crédito real para a banca/autor.
 * NÃO basta a palavra "sucumbência" isolada (pode ser recíproca ou a cargo do autor).
 */
const SUCUMBENCIA_CREDITO =
  /ARBITRO\s+OS\s+HONOR[AÁ]RIOS|FIXO\s+OS\s+HONOR[AÁ]RIOS|HONOR[AÁ]RIOS\s+ADVOCAT[IÍ]CIOS\s+(EM\s+)?\d|HONOR[AÁ]RIOS\s+DE\s+10%|CONDENO\s+.*HONOR[AÁ]RIOS|HONOR[AÁ]RIOS\s+A\s+CARGO\s+D[OA]\s+R[EÉ]U|HONOR[AÁ]RIOS\s+PELO\s+R[EÉ]U|SUCUMB[EÊ]NCIA\s+A\s+CARGO\s+D[OA]\s+R[EÉ]U|R[EÉ]U\s+ARCAR[AÁ]?\s+COM\s+.*HONOR|CONDENADO\s+O\s+R[EÉ]U\s+.*HONOR|PAGAR\s+HONOR[AÁ]RIOS\s+ADVOCAT/i;

/** Menção genérica a sucumbência (precisa cruzar com crédito) */
const SUCUMBENCIA_GEN =
  /SUCUMB[EÊ]NCIA|HONOR[AÁ]RIOS\s+ADVOCAT[IÍ]CIOS|HONOR[AÁ]RIOS\s+DE\s+SUCUMB/i;

/**
 * Casos "ruins" para sucumbência: cada parte arca com os seus / recíproca /
 * autor sucumbente / improcedência com honorários a cargo do autor.
 */
const SUCUMBENCIA_RUIM =
  /SUCUMB[EÊ]NCIA\s+REC[IÍ]PROCA|RECIPROCIDADE\s+DE\s+SUCUMB|CADA\s+PARTE\s+ARCAR[AÁ]?\s+COM\s+S[EU]US|CADA\s+UMA\s+DAS\s+PARTES\s+ARCAR|HONOR[AÁ]RIOS\s+A\s+CARGO\s+D[OA]\s+AUTOR|AUTOR\s+ARCAR[AÁ]?\s+COM\s+.*HONOR|SUCUMBENTE\s+O\s+AUTOR|AUTOR\s+SUCUMBIU|IMPROCED[EÊ]NCIA\s+.*HONOR[AÁ]RIOS\s+A\s+CARGO\s+D[OA]\s+AUTOR|COMPENSAÇÃO\s+DE\s+HONOR[AÁ]RIOS|COMPENSACAO\s+DE\s+HONORARIOS/i;

const QUANTIA_NEG =
  /COMPENSA[CÇ][AÃ]O\s+COM\s+O\s+D[EÉ]BITO|ENCONTRO\s+DE\s+CONTAS|ABATIMENTO\s+DA\s+D[IÍ]VIDA|SEM\s+CONDENA[CÇ][AÃ]O\s+EM\s+QUANTIA|MERO\s+DECLARAT[OÓ]RIO|APENAS\s+DECLARAT/i;

const ART_523 =
  /ART\.?\s*523|PAGAMENTO\s+VOLUNT[AÁ]RIO|15\s+DIAS\s+PARA\s+CUMPRIMENTO|MULTA\s+DE\s+10%/i;

const FAZENDA =
  /UNI[AÃ]O\s+FEDERAL|FAZENDA\s+P[UÚ]BLICA|INSS|INSTITUTO\s+NACIONAL|ESTADO\s+DE\s+|MUNIC[IÍ]PIO\s+DE\s+|PREFEITURA|AUTARQUIA/i;

const PEDIDO_NEGADO =
  /PEDIDO\s+DE\s+CUMPRIMENTO\s+.*INDEFER|INDEFERIDO\s+O\s+CUMPRIMENTO|CUMPRIMENTO\s+INDEFERIDO/i;

function empty(motivos: string[], riscos: string[] = []): OportunidadeInstaurarCumprimento {
  return {
    elegivel: false,
    score: 0,
    motivos,
    riscos,
    tipo_credito: 'incerto',
    acima_limiar_cobranca: false,
    confianca_analise: 0,
    dias_apos_transito: null,
    requer_revisao_humana: true,
  };
}

/**
 * Calcula elegibilidade + score comercial para instaurar cumprimento
 * com foco em honorários (cliente e/ou sucumbência com crédito real).
 *
 * Não marca sucumbência em casos "ruins" (improcedente, recíproca, a cargo do autor).
 */
export function scoreOportunidadeCumprimentoHonorarios(
  input: InputOportunidade
): OportunidadeInstaurarCumprimento {
  const blob = String(input.blob || '').toUpperCase();
  const confianca = Math.max(0, Math.min(100, Number(input.confianca) || 0));
  const dias = input.dias_apos_transito ?? null;
  const motivos: string[] = [];
  const riscos: string[] = [];

  // —— Casos ruins: improcedência pura ——
  if (input.merito_tipo === 'improcedente' && !input.is_procedente) {
    return empty(
      ['mérito improcedente — sem crédito do cliente para instaurar'],
      ['caso ruim: não há sucumbência a favor do autor']
    );
  }

  if (input.em_cumprimento_sentenca || input.cumprimento_ativo) {
    return empty(['já em cumprimento — não é oportunidade de instaurar'], ['fase já instaurada']);
  }
  if (input.cumprimento_encerrado) {
    return empty(['cumprimento já encerrado/quitado'], ['sem proveito de instaurar']);
  }
  if (input.declaratorio_sem_quantia) {
    return empty(['procedente declaratório sem quantia'], ['baixo proveito econômico']);
  }

  // Sucumbência "ruim" (recíproca / a cargo do autor) — bloqueia crédito de sucumbência
  const sucumbenciaRuim = SUCUMBENCIA_RUIM.test(blob);
  if (sucumbenciaRuim) {
    riscos.push('sucumbência recíproca ou a cargo do autor — sem honorários cobráveis da banca');
  }

  const basePendente = !!input.cumprimento_pendente_necessario;
  const baseAlternativa =
    input.is_procedente &&
    !input.em_cumprimento_sentenca &&
    !input.cumprimento_encerrado &&
    confianca >= 70 &&
    !!input.transito_fonte;

  if (!basePendente && !baseAlternativa) {
    return empty(
      ['sem base jurídica de pendência (procedente+trânsito+sem fase)'],
      confianca < 70 ? ['confiança baixa'] : []
    );
  }
  if (basePendente) motivos.push('base: cumprimento_pendente_necessario');
  if (baseAlternativa && !basePendente) motivos.push('base: procedente + trânsito + confiança≥70');

  const temQuantia = QUANTIA_POS.test(blob);
  const temSucumbenciaCredito = SUCUMBENCIA_CREDITO.test(blob) && !sucumbenciaRuim;
  const temSucumbenciaGen = SUCUMBENCIA_GEN.test(blob) && !sucumbenciaRuim;
  const temNegativo = QUANTIA_NEG.test(blob);
  const tem523 = ART_523.test(blob);
  const ehFazenda = FAZENDA.test(blob) || FAZENDA.test(String(input.parte_passiva || ''));
  const pedidoNegado = PEDIDO_NEGADO.test(blob);
  const passiva = String(input.parte_passiva || '') + ' ' + blob;
  const ehReuPrivado = /BANCO|S\.A\.|SA\b|LTDA|FINANCEIRA|CR[EÉ]DITO|SEGURADORA|COOPERATIVA\s+DE\s+CR[EÉ]DITO/i.test(passiva);

  if (temNegativo && !temQuantia && !temSucumbenciaCredito) {
    return empty(
      ['compensação/encontro de contas sem crédito líquido claro'],
      ['risco de título sem quantia executável']
    );
  }

  // Tipo de crédito — sucumbência só com sinal de crédito real (não genérico em caso ruim)
  let tipo: TipoCreditoOportunidade = 'incerto';
  if (temQuantia && temSucumbenciaCredito) tipo = 'ambos';
  else if (temSucumbenciaCredito) tipo = 'sucumbencia';
  else if (temQuantia) tipo = 'cliente';
  else if (temSucumbenciaGen && input.merito_tipo === 'procedente' && !sucumbenciaRuim) {
    // menção genérica + procedente total → possível, mas incerto
    tipo = 'incerto';
    riscos.push('sucumbência genérica no texto — confirmar se a cargo do réu');
  } else {
    tipo = 'incerto';
  }

  // Score comercial
  let score = 30;
  if (input.transito_fonte === 'tpu-848') {
    score += 25;
    motivos.push('trânsito TPU 848');
  } else if (input.transito_fonte === 'texto-movimento') {
    score += 15;
    motivos.push('trânsito em texto do movimento');
  } else if (input.transito_fonte === 'djen-certidao') {
    score += 10;
    motivos.push('trânsito via DJEN');
  }

  if (input.merito_tipo === 'procedente') {
    score += 15;
    motivos.push('procedente total');
  } else if (input.merito_tipo === 'parcial') {
    if (temQuantia || temSucumbenciaCredito) {
      score += 12;
      motivos.push('parcial com indício de quantia/sucumbência a favor');
    } else {
      score -= 15;
      riscos.push('parcial sem valor nem sucumbência clara a favor');
    }
  }

  if (temQuantia) {
    score += 10;
    motivos.push('sinais de condenação em quantia/R$');
  }
  if (temSucumbenciaCredito) {
    score += 12;
    motivos.push('sucumbência/honorários a cargo do réu (crédito banca)');
  } else if (temSucumbenciaGen && !sucumbenciaRuim) {
    score += 4;
    motivos.push('menção a sucumbência (confirmar teor)');
  }
  if (sucumbenciaRuim) {
    score -= 25;
  }
  if (tem523) {
    score += 15;
    motivos.push('art. 523 / pagamento em 15 dias');
  }
  if (dias != null && dias > 60) {
    score += 8;
    motivos.push(`>${dias}d após trânsito sem cumprimento`);
  } else if (dias != null && dias > 30) {
    score += 10;
    motivos.push(`>${dias}d após trânsito (voluntário provavelmente esgotado)`);
  } else if (dias != null && dias > 15) {
    score += 5;
    motivos.push(`${dias}d após trânsito`);
  }

  if (ehFazenda) {
    score -= 10;
    riscos.push('possível Fazenda Pública — regras de honorários distintas');
  } else if (ehReuPrivado) {
    score += 10;
    motivos.push('réu privado/banco — perfil típico de cobrança');
  }

  if (temNegativo) {
    score -= 20;
    riscos.push('compensação/encontro de contas no teor');
  }
  if (pedidoNegado) {
    score -= 20;
    riscos.push('já houve pedido de cumprimento indeferido/extinto');
  }
  if (confianca < LIMIAR_CONFIANCA_MIN) {
    score -= 15;
    riscos.push(`confiança da análise ${confianca}<${LIMIAR_CONFIANCA_MIN}`);
  }

  score = Math.max(0, Math.min(100, score));

  // Crédito cobrável: quantia ou sucumbência com crédito real (não a "ruim")
  const temCreditoSinal = temQuantia || temSucumbenciaCredito;
  const confiancaOk = confianca >= LIMIAR_CONFIANCA_MIN || (tem523 && confianca >= 50);
  const elegivel =
    (basePendente || baseAlternativa) &&
    temCreditoSinal &&
    !input.declaratorio_sem_quantia &&
    confiancaOk &&
    !pedidoNegado &&
    !sucumbenciaRuim;

  if (!temCreditoSinal) {
    riscos.push('sem quantia nem sucumbência a favor detectável no texto indexado');
  }
  if (!elegivel && temCreditoSinal) {
    riscos.push('não elegível — revisar teor antes de cobrar');
  }

  const acima = elegivel && score >= LIMIAR_COBRANCA;
  const requerRevisao = !elegivel || confianca < LIMIAR_REVISAO_HUMANA || score < 70 || tipo === 'incerto';

  if (elegivel) {
    motivos.push(
      acima
        ? `elegível · score ${score} ≥ limiar ${LIMIAR_COBRANCA}`
        : `elegível · score ${score} (abaixo do limiar ${LIMIAR_COBRANCA})`
    );
  }

  return {
    elegivel,
    score,
    motivos,
    riscos,
    tipo_credito: tipo,
    acima_limiar_cobranca: acima,
    confianca_analise: confianca,
    dias_apos_transito: dias,
    requer_revisao_humana: requerRevisao,
  };
}

export const LIMIAR_OPORTUNIDADE_COBRANCA = LIMIAR_COBRANCA;

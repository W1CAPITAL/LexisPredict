/**
 * Score de oportunidade para instaurar cumprimento com viés de honorários.
 * Camada comercial em cima de cumprimento_pendente_necessario (base jurídica).
 *
 * Art. 523 §1º CPC + Súmula 517 STJ: após 15 dias sem pagamento voluntário,
 * multa 10% + honorários 10% sobre o valor do débito.
 */
export type TipoCreditoOportunidade = 'cliente' | 'sucumbencia' | 'ambos' | 'incerto';

export type OportunidadeInstaurarCumprimento = {
  elegivel: boolean;
  score: number;
  motivos: string[];
  riscos: string[];
  tipo_credito: TipoCreditoOportunidade;
  /** Limiar operacional sugerido para fila de cobrança */
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
  /** Blob unificado: movimentos + DJEN + último nome */
  blob?: string | null;
  /** Nome do réu / parte passiva (heurística Fazenda) */
  parte_passiva?: string | null;
};

const LIMIAR_COBRANCA = 55;
const LIMIAR_CONFIANCA_MIN = 60;
const LIMIAR_REVISAO_HUMANA = 75;

const QUANTIA_POS =
  /CONDENO\s+A\s+PAGAR|OBRIGAÇÃO\s+DE\s+PAGAR|OBRIGACAO\s+DE\s+PAGAR|RESTITUI[CÇ][AÃ]O|DEVOLU[CÇ][AÃ]O|INDENIZA[CÇ][AÃ]O|R\$\s*\d|VALOR\s+DE\s+R\$|CUSTAS\s+E\s+HONOR[AÁ]RIOS|PAGAR\s+O\s+VALOR|CONDENAÇÃO\s+EM\s+QUANTIA|CONDENACAO\s+EM\s+QUANTIA/i;

const SUCUMBENCIA =
  /SUCUMB[EÊ]NCIA|ARBITRO\s+OS\s+HONOR[AÁ]RIOS|FIXO\s+OS\s+HONOR[AÁ]RIOS|HONOR[AÁ]RIOS\s+ADVOCAT[IÍ]CIOS|HONOR[AÁ]RIOS\s+DE\s+10%|CONDENO\s+.*HONOR[AÁ]RIOS/i;

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
 * com foco em honorários (cliente e/ou sucumbência).
 */
export function scoreOportunidadeCumprimentoHonorarios(
  input: InputOportunidade
): OportunidadeInstaurarCumprimento {
  const blob = String(input.blob || '').toUpperCase();
  const confianca = Math.max(0, Math.min(100, Number(input.confianca) || 0));
  const dias = input.dias_apos_transito ?? null;
  const motivos: string[] = [];
  const riscos: string[] = [];

  // Já em fase / já encerrado → fora da fila de "instaurar"
  if (input.em_cumprimento_sentenca || input.cumprimento_ativo) {
    return empty(['já em cumprimento — não é oportunidade de instaurar'], ['fase já instaurada']);
  }
  if (input.cumprimento_encerrado) {
    return empty(['cumprimento já encerrado/quitado'], ['sem proveito de instaurar']);
  }
  if (input.declaratorio_sem_quantia) {
    return empty(['procedente declaratório sem quantia'], ['baixo proveito econômico']);
  }

  // Base jurídica: pendente OU (procedente + trânsito implícito via pendente false but high conf)
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
  const temSucumbencia = SUCUMBENCIA.test(blob);
  const temNegativo = QUANTIA_NEG.test(blob);
  const tem523 = ART_523.test(blob);
  const ehFazenda = FAZENDA.test(blob) || FAZENDA.test(String(input.parte_passiva || ''));
  const pedidoNegado = PEDIDO_NEGADO.test(blob);

  if (temNegativo && !temQuantia && !temSucumbencia) {
    return empty(
      ['compensação/encontro de contas sem crédito líquido claro'],
      ['risco de título sem quantia executável']
    );
  }

  // Tipo de crédito
  let tipo: TipoCreditoOportunidade = 'incerto';
  if (temQuantia && temSucumbencia) tipo = 'ambos';
  else if (temSucumbencia) tipo = 'sucumbencia';
  else if (temQuantia) tipo = 'cliente';
  else tipo = 'incerto';

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
    if (temQuantia) {
      score += 12;
      motivos.push('parcial com indício de quantia/restituição');
    } else {
      score -= 15;
      riscos.push('parcial sem valor claro');
    }
  }

  if (temQuantia) {
    score += 10;
    motivos.push('sinais de condenação em quantia/R$');
  }
  if (temSucumbencia) {
    score += 12;
    motivos.push('sucumbência/honorários fixados na sentença');
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
  } else if (/BANCO|S\.A\.|SA\b|LTDA|FINANCEIRA|CREDITO|CRÉDITO|SEGURADORA/i.test(blob + ' ' + String(input.parte_passiva || ''))) {
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

  // Elegibilidade mínima
  const temCreditoSinal = temQuantia || temSucumbencia;
  const confiancaOk = confianca >= LIMIAR_CONFIANCA_MIN || (tem523 && confianca >= 50);
  const elegivel =
    (basePendente || baseAlternativa) &&
    temCreditoSinal &&
    !input.declaratorio_sem_quantia &&
    confiancaOk &&
    !pedidoNegado;

  if (!temCreditoSinal) riscos.push('sem quantia nem sucumbência detectável no texto');
  if (!elegivel && temCreditoSinal) riscos.push('não elegível — revisar teor antes de cobrar');

  const acima = elegivel && score >= LIMIAR_COBRANCA;
  const requerRevisao = !elegivel || confianca < LIMIAR_REVISAO_HUMANA || score < 70;

  if (elegivel) motivos.push(acima ? `elegível · score ${score} ≥ limiar ${LIMIAR_COBRANCA}` : `elegível · score ${score} (abaixo do limiar ${LIMIAR_COBRANCA})`);

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

/** Limiar padrão para fila de cobrança */
export const LIMIAR_OPORTUNIDADE_COBRANCA = LIMIAR_COBRANCA;

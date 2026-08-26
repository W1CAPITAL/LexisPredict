/**
 * Extrai "O que o juiz determinou" a partir do blob DataJud/DJEN (heurístico).
 * LLM opcional fica fora deste lote — só texto já indexado.
 */

export type DispositivoResumo = {
  bullets: string[];
  merito: 'procedente' | 'parcial' | 'improcedente' | 'incerto';
  encontroContas: boolean;
  teorOk: boolean;
  temQuantia: boolean;
  temHonorariosReu: boolean;
  sucumbenciaReciproca: boolean;
};

const ENCONTRO =
  /ENCONTRO\s+DE\s+CONTAS|COMPENSA[CÇ][AÃ]O\s+(DE\s+)?(CR[EÉ]DITOS|VALORES)|ABATA?\s+(DO|NO)\s+SALDO|DEDUZ[IA].{0,40}D[IÍ]VIDA|COMPENSAR\s+COM\s+O\s+D[EÉ]BITO/i;

const QUANTIA =
  /CONDENO\s+.{0,40}PAGAR|RESTITUI|DEVOLU[CÇ][AÃ]O|R\$\s*\d|INDENIZA|REPETI[CÇ][AÃ]O\s+DE\s+IND[EÉ]BITO|OBRIGAÇÃO\s+DE\s+PAGAR/i;

const HON_REU =
  /HONOR[AÁ]RIOS.{0,30}(R[EÉ]U|R[EÉ]|BANCO|INSTITUI[CÇ][AÃ]O)|A\s+CARGO\s+D[OA]\s+R[EÉ]U|ARBITRO\s+OS\s+HONOR[AÁ]RIOS|FIXO\s+OS\s+HONOR[AÁ]RIOS/i;

const RECIPROCA =
  /SUCUMB[EÊ]NCIA\s+REC[IÍ]PROCA|RECIPROCAMENTE|HONOR[AÁ]RIOS.{0,20}A\s+CARGO\s+D[OA]\s+AUTOR/i;

export function extrairDispositivoBullets(blob: string | null | undefined): DispositivoResumo {
  const text = String(blob || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  const u = text.toUpperCase();
  const bullets: string[] = [];

  let merito: DispositivoResumo['merito'] = 'incerto';
  if (/\bIMPROCEDENTE\b/.test(u) && !/\bPROCEDENTE\b/.test(u.replace('IMPROCEDENTE', ''))) {
    merito = 'improcedente';
    bullets.push('Mérito: improcedente (sem crédito do autor para instaurar).');
  } else if (/PARCIALMENTE\s+PROCEDENTE|PROCEDENTE\s+EM\s+PARTE/.test(u)) {
    merito = 'parcial';
    bullets.push('Mérito: parcialmente procedente.');
  } else if (/\bJULGO\s+PROCEDENTE\b|\bPROCEDENTE\s+O\s+PEDIDO\b|\bPEDIDOS?\s+PROCEDENTES?\b/.test(u)) {
    merito = 'procedente';
    bullets.push('Mérito: procedente.');
  }

  const temQuantia = QUANTIA.test(text);
  if (temQuantia) bullets.push('Há indício de condenação em quantia / restituição / indenização.');

  const temHonorariosReu = HON_REU.test(text) && !RECIPROCA.test(text);
  if (temHonorariosReu) bullets.push('Honorários com sinal a cargo do réu (possível sucumbência cobrável).');

  const sucumbenciaReciproca = RECIPROCA.test(text);
  if (sucumbenciaReciproca) bullets.push('Atenção: sucumbência recíproca ou a cargo do autor — revisar antes de cobrar.');

  const encontroContas = ENCONTRO.test(text);
  if (encontroContas) {
    bullets.push('Alerta: possível encontro de contas / compensação com saldo devedor.');
  }

  if (/TR[AÂ]NSITO\s+EM\s+JULGADO|BAIXA\s+DEFINITIVA/.test(u)) {
    bullets.push('Sinal de trânsito em julgado ou baixa definitiva no texto indexado.');
  }

  if (/CUMPRIMENTO\s+DE\s+SENTEN[CÇ]A|EXECU[CÇ][AÃ]O\s+DE\s+SENTEN[CÇ]A/.test(u)) {
    bullets.push('Texto menciona cumprimento/execução de sentença — conferir se já instaurado.');
  }

  // teorOk: texto longo o bastante e não só nomes genéricos
  const generico =
    text.length < 80 ||
    /^(DOCUMENTO|PUBLICA[CÇ][AÃ]O|EXPEDIDA|CERTIFICADA|MOVIMENTO)\b/i.test(text);
  const teorOk = text.length >= 120 && !generico;

  if (!teorOk && bullets.length === 0) {
    bullets.push('Teor insuficiente no índice (texto pobre) — enriquecer DJEN/DataJud antes de prometer valores.');
  }

  return {
    bullets: bullets.slice(0, 6),
    merito,
    encontroContas,
    teorOk,
    temQuantia,
    temHonorariosReu,
    sucumbenciaReciproca,
  };
}

/** Hard block: nunca exibir R$ ao cliente sem teor + bases. */
export function podeExibirValorMonetario(opts: {
  teorSentencaOk: boolean;
  contratoCamposMinimos?: boolean;
  aprovadoHumano?: boolean;
}): boolean {
  return !!(opts.teorSentencaOk && opts.contratoCamposMinimos && opts.aprovadoHumano);
}

export function scriptWhatsAppCumprimentoSemValor(nome: string, cnj: string): string {
  const n = (nome || 'Cliente').split(/\s+/)[0];
  return [
    `Olá, ${n}! Tudo bem?`,
    ``,
    `Trazendo uma atualização sobre o processo nº ${cnj}.`,
    ``,
    `Houve movimentação relevante e nossa equipe está avaliando os próximos passos, inclusive a eventual elaboração de cálculos, quando couber.`,
    ``,
    `Assim que tivermos orientação segura e revisada, retornamos com os detalhes. Por enquanto não há valor a informar.`,
    ``,
    `Qualquer dúvida, estamos à disposição.`,
  ].join('\n');
}

/**
 * Motor de mensagem ao cliente v14.0 — CUSTAS URGENTES + SEM MÉRITO + NUNCA "NÃO AJA"
 *
 * Casos de referência:
 * - Darlan: boleto PAGO → não falar pendência
 * - Aurineide: custas EM ABERTO R$ 192,10 + intimação + carta → URGENTE, nunca "não precisa agir"
 *              extinção art. 485 / cancelamento distribuição → NÃO dizer "mérito decidido"
 *
 * @copyright 2026 Davi Alves Figueredo / W1 Capital Assessoria Financeira Ltda.
 */

import { parseISO, parse, isValid, format } from 'date-fns';
import { SCRIPT_CATALOG, ScriptTemplate } from './catalog';

export interface ScriptSuggestion {
  categoria: string;
  titulo: string;
  texto: string;
  quandoUsar: string;
}

export interface ScriptInput {
  clienteNome?: string;
  protocolo: string;
  ultimoRetorno?: string | null;
  movimentos?: Array<{
    nome?: string;
    complemento?: string;
    descricao?: string;
    dataHora?: string;
  }>;
  evento_tipo?: string | null;
  eventoTipo?: string | null;
  evento_resumo?: string | null;
  eventoResumo?: string | null;
  djen_ultimo_resumo?: string | null;
  djenTexts?: string[];
  tem_novo_andamento?: boolean;
  tem_atualizacao_pos_retorno?: boolean;
  djen_nova_comunicacao?: boolean;
  datajud_encerrado_tribunal?: boolean;
  em_cumprimento_sentenca?: boolean;
  indicio_busca_apreensao?: boolean;
  busca_apreensao?: boolean;
}

function firstName(full?: string): string {
  const n = (full || 'Cliente').trim().split(/\s+/)[0];
  return n ? n.charAt(0).toUpperCase() + n.slice(1).toLowerCase() : 'Cliente';
}

function fmtDate(raw?: string | null): string {
  if (!raw) return '';
  try {
    const clean = raw.trim();
    const d = clean.includes('/')
      ? parse(clean, 'dd/MM/yyyy', new Date())
      : parseISO(clean);
    if (isValid(d)) return format(d, 'dd/MM/yyyy');
  } catch {
    //
  }
  return '';
}

function buildCorpus(input: ScriptInput): string {
  return [
    input.evento_resumo || '',
    input.eventoResumo || '',
    input.djen_ultimo_resumo || '',
    ...(input.djenTexts || []),
    ...(input.movimentos || []).map(
      (m) => `${m.nome || ''} ${m.complemento || ''} ${m.descricao || ''} ${m.dataHora || ''}`
    ),
  ].join('\n');
}

function msg(lines: string[]): string {
  return lines.filter((l) => l !== undefined && l !== null).join('\n');
}

/** Qualquer R$ no corpus */
function extractValor(U: string): string | null {
  const m =
    U.match(/R\$\s*([\d.]+,\d{2})/i) ||
    U.match(/valor\s+de\s+R\$\s*([\d.]+,\d{2})/i);
  return m ? `R$ ${m[1]}` : null;
}

function extractPrazoDias(U: string): string | null {
  const m = U.match(
    /prazo\s+de\s+(\d+)\s*\(?\s*dias?|no\s+prazo\s+de\s+(\d+)\s*\(?\s*dias?/i
  );
  return m ? m[1] || m[2] : null;
}

type Signals = {
  ba: boolean;
  baixaDefinitiva: boolean;
  transito: boolean;
  arquivamento: boolean;
  extinçãoSemMerito: boolean;
  cancelamentoDistribuicao: boolean;
  art485: boolean;
  emendaInicial: boolean;
  numopede: boolean;
  gratuidadeIndeferida: boolean;
  hipossuficiencia: boolean;
  /** Custas realmente pagas */
  custasPagas: boolean;
  /**
   * Cobrança ATIVA: em aberto, intimação para pagar, carta, taxa judiciária a recolher.
   * Se true → NUNCA "não precisa agir".
   */
  custasUrgentes: boolean;
  valorCustas: string | null;
  prazoDias: string | null;
  cartaIntimacao: boolean;
  dividaAtivaRisco: boolean;
  procedenteParcial: boolean;
  procedente: boolean;
  improcedente: boolean;
  compensacao: boolean;
  seguroPrestamista: boolean;
  audiencia: boolean;
  cumprimento: boolean;
};

function detectSignals(U: string, input: ScriptInput): Signals {
  const et = String(input.evento_tipo || input.eventoTipo || '').toLowerCase();

  const custasPagas =
    /boleto\s+pago|registro\s+de\s+pagamento|pagamento\s+confirmado|guia.{0,40}paga|custas?\s+pagas?|taxa\s+paga|(?:pago|baixado)\s*[-–—]?\s*r\$|r\$.{0,20}(?:pago|baixado)|juntada\s*[-–—]?\s*registro\s+de\s+pagamento/i.test(
      U
    );

  // Pendência explícita (Aurineide)
  const custasUrgentes =
    !custasPagas &&
    (/custas?\s+processuais?\s+em\s+aberto|em\s+aberto,?\s+no\s+valor|efetue\s+o\s+pagamento\s+das\s+custas|pagamento\s+taxa\s+judici[aá]ria|intimação.{0,80}pagamento|carta\s+de\s+intimação.{0,40}pagamento|recolhimento\s+(?:integral\s+)?das\s+custas|taxa\s+judici[aá]ria|recolher\s+as\s+custas|5\s*ufesp|d[ií]vida\s+ativa|fedtj|c[oó]digo\s+224/i.test(
      U
    ) ||
      (/intimação.{0,60}custas|custas.{0,40}intimação|pagamento.{0,30}custas|custas.{0,30}pagamento/i.test(
        U
      ) &&
        /r\$\s*[\d.,]+/i.test(U)));

  const extinçãoSemMerito =
    /julgo\s+extinto|extinto\s+o\s+processo|extin[çc][aã]o\s+do\s+processo|aus[êe]ncia\s+de\s+pressupostos|cancelamento\s+da\s+distribui[çc][aã]o|cancelada\s+a\s+distribui[çc][aã]o|sem\s+resolu[çc][aã]o\s+do\s+m[eé]rito|sem\s+julgamento\s+do\s+m[eé]rito|indeferida\s+a\s+peti[çc][aã]o\s+inicial/i.test(
      U
    ) ||
    /artigo\s+485|art\.?\s*485|485,\s*[xiv]/i.test(U);

  return {
    ba:
      !!(input.indicio_busca_apreensao || input.busca_apreensao) ||
      /busca\s+e\s+apreens[aã]o|reintegra[çc][aã]o\s+de\s+posse/i.test(U),
    baixaDefinitiva: /baixa\s+definitiva/i.test(U),
    transito:
      !!input.datajud_encerrado_tribunal ||
      et.includes('transito') ||
      et.includes('baixa') ||
      /tr[âa]nsito\s+em\s+julgado|transitado\s+em\s+julgado|baixa\s+definitiva/i.test(U),
    arquivamento: /arquiv/i.test(U),
    extinçãoSemMerito,
    cancelamentoDistribuicao:
      /cancelamento\s+da\s+distribui[çc][aã]o|cancelada\s+a\s+distribui[çc][aã]o|art\.?\s*290/i.test(
        U
      ),
    art485: /artigo\s+485|art\.?\s*485|485,\s*[xiv]/i.test(U),
    emendaInicial: /emenda\s+[àa]\s+inicial|emendar\s+a\s+inicial/i.test(U),
    numopede: /numopede|demandas?\s+repetitivas|demandas?\s+predat/i.test(U),
    gratuidadeIndeferida:
      /justi[çc]a\s+gratuita:\s*indeferida|gratuidade.{0,25}indefer|indeferida?\s+a\s+gratuidade|n[aã]o\s+sendo\s+a\s+parte\s+autora\s+benefici[aá]ria/i.test(
        U
      ),
    hipossuficiencia:
      /hipossuficiente|comprove.{0,40}condi[çc][aã]o|extrato\s+banc[aá]rio|declara[çc][aã]o\s+de\s+imposto\s+de\s+renda/i.test(
        U
      ),
    custasPagas,
    custasUrgentes,
    valorCustas: extractValor(U),
    prazoDias: extractPrazoDias(U),
    cartaIntimacao:
      /carta\s+(?:de\s+)?intimação|carta\s+recebida|correios|intimação\s+[-–—]\s*pagamento/i.test(
        U
      ),
    dividaAtivaRisco:
      /d[ií]vida\s+ativa|inscri[çc][aã]o\s+na\s+d[ií]vida|certid[aã]o\s+para\s+inscri[çc][aã]o/i.test(
        U
      ),
    procedenteParcial:
      /procedente\s+em\s+parte|julgo\s+procedente\s+em\s+parte|parcialmente\s+procedente/i.test(U),
    procedente:
      /julgo\s+procedente(?!\s+em\s+parte)/i.test(U) && !/improcedente|em\s+parte/i.test(U),
    improcedente: et === 'sentenca_improcedente' || /improcedente|julgo\s+improcedente/i.test(U),
    compensacao: /compensa[çc][aã]o|encontro\s+de\s+contas|artigo\s+368/i.test(U),
    seguroPrestamista: /seguro\s+prestamista|tarifa\s+de\s+seguro/i.test(U),
    audiencia: et.includes('audiencia') || /audi[êe]ncia/i.test(U),
    cumprimento:
      !!input.em_cumprimento_sentenca ||
      et.includes('cumprimento') ||
      /cumprimento\s+de\s+senten[çc]a/i.test(U),
  };
}

/** Frase de valor + prazo para custas urgentes */
function blocoCustasUrgentes(s: Signals): string[] {
  const valor = s.valorCustas || 'o valor indicado pelo tribunal';
  const prazo = s.prazoDias ? `${s.prazoDias} dias` : 'o prazo fixado na intimação';
  const lines = [
    `O Tribunal de Justiça intimou para o pagamento das custas processuais em aberto no valor de ${valor}, no prazo de ${prazo}.`,
  ];
  if (s.cartaIntimacao) {
    lines.push(
      `É possível que você tenha recebido (ou receba) uma carta do tribunal sobre essa cobrança na sua residência.`
    );
  }
  lines.push(
    `É importante regularizar essa guia para evitar que o CPF seja inscrito na Dívida Ativa do Estado.`
  );
  lines.push(
    `Nossa equipe pode orientar a emissão/conferência do boleto oficial do tribunal. Responda esta mensagem para alinharmos o pagamento com segurança.`
  );
  return lines;
}

export function suggestScripts(input: ScriptInput): ScriptSuggestion[] {
  const nome = firstName(input.clienteNome);
  const cnj = input.protocolo || 'seu processo';
  const U = buildCorpus(input);
  const s = detectSignals(U, input);
  const out: ScriptSuggestion[] = [];

  // ——— 0. B.A.
  if (s.ba) {
    out.push({
      categoria: 'ba',
      titulo: 'Alerta: indício de busca e apreensão',
      quandoUsar: 'B.A.',
      texto: msg([
        `Olá, ${nome}! Tudo bem?`,
        ``,
        `Preciso te passar uma atualização importante sobre o processo nº ${cnj}.`,
        ``,
        `Identificamos andamento que pode indicar medida de busca e apreensão. Nossa equipe já está avaliando o teor e as medidas cabíveis.`,
        ``,
        `Por segurança, mantenha o bem resguardado e aguarde nosso contato com orientações objetivas ainda hoje, se possível.`,
        ``,
        `Qualquer dúvida urgente, responda esta mensagem.`,
      ]),
    });
  }

  // ——— 1. CUSTAS URGENTES (prioridade máxima após BA) — caso Aurineide
  if (s.custasUrgentes) {
    const contextoExtincao =
      s.extinçãoSemMerito || s.cancelamentoDistribuicao || s.art485
        ? [
            `Revisitando o histórico: este processo foi encerrado sem julgamento do mérito (o problema central com a outra parte não foi decidido pelo juiz).`,
            s.gratuidadeIndeferida || s.hipossuficiencia || s.cancelamentoDistribuicao
              ? `Na prática, isso costuma ocorrer quando a justiça gratuita não foi aceita na época e as custas iniciais não foram recolhidas — a distribuição pode ser cancelada e o feito baixado.`
              : `Foi uma extinção formal / cancelamento, não uma vitória nem uma derrota sobre o direito em si.`,
            ``,
          ]
        : s.baixaDefinitiva || s.transito
          ? [
              `O processo consta com baixa / encerramento no tribunal. Isso não elimina automaticamente cobranças de taxa do Estado pela movimentação do processo.`,
              ``,
            ]
          : [];

    out.push({
      categoria: 'custas',
      titulo: 'URGENTE: custas em aberto',
      quandoUsar: 'Intimação de pagamento / carta / valor em aberto',
      texto: msg([
        `Olá, ${nome}! Tudo bem?`,
        ``,
        `Entramos em contato para uma atualização importante sobre o processo nº ${cnj}.`,
        ``,
        ...contextoExtincao,
        ...blocoCustasUrgentes(s),
        ``,
        `Se tiver qualquer dúvida, nossa equipe está à disposição.`,
      ]),
    });
  }

  // ——— 2. Extinção sem mérito SEM custas urgentes (ou já pagas)
  if (
    (s.extinçãoSemMerito || s.cancelamentoDistribuicao) &&
    !s.custasUrgentes &&
    out.length < 3
  ) {
    const valorLine = s.custasPagas
      ? s.valorCustas
        ? `A boa notícia é que o tribunal já registrou o pagamento da taxa (${s.valorCustas}) e a baixa correspondente. Você não possui pendência financeira ativa dessa guia.`
        : `A boa notícia é que o tribunal já registrou o pagamento da taxa e a baixa. Você não possui pendência financeira ativa dessa cobrança.`
      : null;

    out.push({
      categoria: 'baixa',
      titulo: 'Extinção sem julgamento do mérito',
      quandoUsar: 'Art. 485 / cancelamento da distribuição',
      texto: msg([
        `Olá, ${nome}! Tudo bem?`,
        ``,
        `Entro em contato sobre o processo nº ${cnj}.`,
        ``,
        `O juiz encerrou este processo por uma questão formal — e não porque tenha julgado o problema de fundo (o “mérito”) a favor ou contra você.`,
        ``,
        s.cancelamentoDistribuicao || s.gratuidadeIndeferida || s.hipossuficiencia
          ? `Isso costuma acontecer quando a justiça gratuita não é comprovada e as custas iniciais não são recolhidas: o tribunal cancela a distribuição e baixa o feito.`
          : s.numopede || s.emendaInicial
            ? `O tribunal exigiu documentação específica e, sem o envio no prazo, o processo foi extinto.`
            : `Trata-se de extinção formal; o direito material em si não foi analisado.`,
        ``,
        valorLine ||
          `Estamos conferindo se restou alguma providência administrativa no tribunal.`,
        ``,
        `Como o mérito não foi julgado, você não “perdeu” o direito só por esse encerramento formal. Uma nova ação, se fizer sentido, exige documentação completa desde o início.`,
        ``,
        `Qualquer dúvida, nossa equipe segue à disposição.`,
      ]),
    });
  }

  // ——— 3. Trânsito/baixa + custas PAGAS
  if (
    (s.transito || s.baixaDefinitiva || s.arquivamento) &&
    s.custasPagas &&
    !s.custasUrgentes &&
    !s.extinçãoSemMerito &&
    out.length < 3
  ) {
    out.push({
      categoria: 'baixa',
      titulo: 'Baixa — custas quitadas',
      quandoUsar: 'Baixa/trânsito com pagamento registrado',
      texto: msg([
        `Olá, ${nome}! Tudo bem?`,
        ``,
        `Atualização sobre o processo nº ${cnj}.`,
        ``,
        `Consta baixa definitiva ou trânsito no tribunal.`,
        ``,
        s.valorCustas
          ? `Sobre as custas: o pagamento (${s.valorCustas}) já foi registrado e baixado. Não há pendência financeira ativa dessa guia.`
          : `Sobre as custas: o pagamento já foi registrado e baixado. Não há pendência financeira ativa dessa guia.`,
        ``,
        `Se surgir ato residual, te aviso de forma objetiva. Qualquer dúvida, estou à disposição.`,
      ]),
    });
  }

  // ——— 4. Baixa/trânsito SEM sinal de custas (mensagem neutra — sem "não aja" se houver dúvida)
  if (
    (s.transito || s.baixaDefinitiva || s.arquivamento) &&
    !s.custasUrgentes &&
    !s.custasPagas &&
    !s.extinçãoSemMerito &&
    out.length < 3
  ) {
    out.push({
      categoria: 'baixa',
      titulo: 'Baixa / trânsito — conferência',
      quandoUsar: 'Baixa sem corpus claro de custas',
      texto: msg([
        `Olá, ${nome}! Tudo bem?`,
        ``,
        `Trazendo uma atualização sobre o processo nº ${cnj}.`,
        ``,
        `O processo consta com baixa definitiva ou trânsito no sistema do tribunal. Isso indica encerramento desta ação no cartório — e não necessariamente que o juiz tenha julgado o mérito a favor ou contra você.`,
        ``,
        `Nossa equipe está conferindo se existe alguma taxa ou intimação residual do Estado. Assim que confirmarmos, te retorno com orientação objetiva.`,
        ``,
        `Qualquer dúvida, responda esta mensagem.`,
      ]),
    });
  }

  // ——— 5. Mérito parcial / improcedente / audiência / cumprimento
  if (s.procedenteParcial && (s.compensacao || s.seguroPrestamista) && out.length < 3) {
    out.push({
      categoria: 'merito',
      titulo: 'Decisão parcial + encontro de contas',
      quandoUsar: 'Procedente em parte',
      texto: msg([
        `Olá, ${nome}! Tudo bem?`,
        ``,
        `Atualização sobre o processo nº ${cnj}.`,
        ``,
        `O juiz acolheu em parte o pedido. ${
          s.seguroPrestamista
            ? 'Foi reconhecida cobrança indevida relacionada a seguro/tarifas, nos termos da sentença.'
            : 'Há reconhecimento parcial de valores, nos termos da decisão.'
        }`,
        ``,
        s.compensacao
          ? `Na prática pode haver “encontro de contas”: o valor reconhecido pode abater dívida do contrato, e não necessariamente cair como depósito na conta.`
          : `Os valores e a forma de cumprimento ainda passam por conferência.`,
        ``,
        `Assim que tivermos os números objetivos, te retorno.`,
      ]),
    });
  }

  if (s.improcedente && !s.procedenteParcial && out.length < 3) {
    out.push({
      categoria: 'merito',
      titulo: 'Decisão desfavorável',
      quandoUsar: 'Improcedente',
      texto: msg([
        `Olá, ${nome}! Tudo bem?`,
        ``,
        `Preciso te atualizar sobre o processo nº ${cnj}.`,
        ``,
        `Houve uma decisão que não acolheu o pedido principal. Estamos lendo o teor completo e avaliando se cabe recurso ou outra medida.`,
        ``,
        `Em breve te retorno com a orientação clara. Qualquer dúvida, responda esta mensagem.`,
      ]),
    });
  }

  if (s.audiencia && out.length < 3) {
    out.push({
      categoria: 'merito',
      titulo: 'Audiência',
      quandoUsar: 'Audiência',
      texto: msg([
        `Olá, ${nome}! Tudo bem?`,
        ``,
        `Identificamos audiência no processo nº ${cnj}.`,
        ``,
        `Nossa equipe organiza os próximos passos e te orienta com data e se é necessário comparecer. Não se desloque sem nossa confirmação.`,
      ]),
    });
  }

  if (s.cumprimento && out.length < 3) {
    out.push({
      categoria: 'execucao',
      titulo: 'Fase de cumprimento',
      quandoUsar: 'Cumprimento de sentença',
      texto: msg([
        `Olá, ${nome}! Tudo bem?`,
        ``,
        `O processo nº ${cnj} avançou para cumprimento da decisão (valores e forma de pagar/descontar).`,
        ``,
        `Estamos revisando os atos. Assim que houver próximo passo claro, te retorno.`,
      ]),
    });
  }

  // ——— Fallback (sem "não precisa fazer nada" se houver qualquer menção a intimação)
  if (out.length === 0) {
    const temNovidade =
      input.tem_novo_andamento ||
      input.tem_atualizacao_pos_retorno ||
      input.djen_nova_comunicacao ||
      (input.movimentos && input.movimentos.length > 0);

    const mencionaIntimacao = /intimação|intime-se|prazo\s+de\s+\d+/i.test(U);

    out.push({
      categoria: 'andamento',
      titulo: temNovidade ? 'Atualização de andamento' : 'Acompanhamento',
      quandoUsar: 'Sem classificação forte',
      texto: temNovidade
        ? msg([
            `Olá, ${nome}! Tudo bem?`,
            ``,
            `Trazendo uma atualização sobre o processo nº ${cnj}.`,
            ``,
            `Houve movimentação no tribunal. Nossa equipe está analisando o teor completo antes de te passar qualquer conclusão.`,
            ``,
            mencionaIntimacao
              ? `Se a movimentação envolver prazo ou intimação, te orientamos assim que confirmarmos o teor — para não perder prazo.`
              : `Assim que tivermos orientação objetiva, te retorno.`,
            ``,
            `Qualquer dúvida, responda esta mensagem.`,
          ])
        : msg([
            `Olá, ${nome}! Tudo bem?`,
            ``,
            `Passando para atualizar o acompanhamento do processo nº ${cnj}.`,
            ``,
            `Seguimos monitorando. Qualquer novidade relevante, te aviso de forma clara.`,
          ]),
    });
  }

  return out.slice(0, 3);
}

export function applyCatalogTemplate(
  s: ScriptTemplate,
  nome: string,
  cnj: string,
  dateRetornoStr?: string | null,
  dataMovStr?: string
): ScriptSuggestion {
  const displayRetorno = fmtDate(dateRetornoStr) || 'nos últimos dias';
  const displayMov = fmtDate(dataMovStr) || 'recentemente';
  return {
    categoria: s.categoria,
    titulo: s.titulo,
    quandoUsar: s.quandoUsar,
    texto: s.texto
      .replace(/\[CLIENTE\]|\[Nome\]/g, nome)
      .replace(/\[PROTOCOLO\]|\[CNJ\]/g, cnj)
      .replace(/\[Data\]/g, displayRetorno)
      .replace(/\[DataMov\]/g, displayMov),
  };
}

void SCRIPT_CATALOG;

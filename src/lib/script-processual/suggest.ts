/**
 * Motor de mensagem ao cliente v13.0 — CUSTAS + EXTINÇÃO SEM MÉRITO
 *
 * Correções críticas:
 * - "Boleto pago" / "Baixado" / "Registro de pagamento" → NÃO dizer pendência de custas
 * - Extinção art. 485 / ausência de pressupostos → explicar formal, não "perdeu o direito"
 * - Emenda / NUMOPEDE / documentação → contexto honesto e protetivo
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
  return lines.join('\n');
}

/** Extrai valor R$ xxx,xx se houver */
function extractValorPago(U: string): string | null {
  const m = U.match(/R\$\s*([\d.]+,\d{2})/i) || U.match(/R\$\s*([\d]+(?:\.\d{3})*,\d{2})/);
  return m ? `R$ ${m[1]}` : null;
}

/** Data aproximada de pagamento se aparecer perto de "pago/baixado" */
function extractDataPagamento(U: string): string | null {
  const m = U.match(
    /(\d{2}\/\d{2}\/\d{4}).{0,40}(?:pago|baixado)|(?:pago|baixado).{0,40}(\d{2}\/\d{2}\/\d{4})|(\d{4}-\d{2}-\d{2}).{0,40}(?:pago|baixado)/i
  );
  if (!m) return null;
  return m[1] || m[2] || (m[3] ? fmtDate(m[3]) : null);
}

type Signals = {
  ba: boolean;
  transito: boolean;
  arquivamento: boolean;
  extinçãoSemMerito: boolean;
  art485: boolean;
  emendaInicial: boolean;
  numopede: boolean;
  gratuidadeIndeferida: boolean;
  /** Houve cobrança/menção a custas ou taxa judiciária */
  custasMencionadas: boolean;
  /** Guia gerada / link pagamento / intimação para recolher */
  custasCobradas: boolean;
  /** Boleto pago, baixado, registro de pagamento — pendência ZERADA */
  custasPagas: boolean;
  valorPago: string | null;
  dataPagamento: string | null;
  procedenteParcial: boolean;
  procedente: boolean;
  improcedente: boolean;
  compensacao: boolean;
  seguroPrestamista: boolean;
  documentosNovos: boolean;
  audiencia: boolean;
  cumprimento: boolean;
  liminar: boolean;
  intimacaoPrazo: boolean;
  prazoDias: string | null;
};

function detectSignals(U: string, input: ScriptInput): Signals {
  const et = String(input.evento_tipo || input.eventoTipo || '').toLowerCase();

  const custasPagas =
    /boleto\s+pago|registro\s+de\s+pagamento|pagamento\s+confirmado|guia.{0,40}paga|custas?\s+pagas?|taxa\s+paga|baixado\s*[-–—]?\s*r\$|r\$.{0,15}baixado|(?:pago|baixado).{0,20}r\$/i.test(
      U
    ) || /juntada\s*[-–—]?\s*registro\s+de\s+pagamento/i.test(U);

  const custasCobradas =
    !custasPagas &&
    /recolher\s+a\s+taxa|taxa\s+judici[aá]ria|guia\s+gerada|link\s+para\s+pagamento|intime-se.{0,40}recolher|pagamento\s+da\s+taxa|inscri[cç][aã]o\s+na\s+d[ií]vida\s+ativa|custas?\s+processuais/i.test(
      U
    );

  const custasMencionadas =
    custasPagas ||
    custasCobradas ||
    /custa|taxa\s+judici|recolhimento|guia\s+\d+|boleto/i.test(U);

  return {
    ba:
      !!(input.indicio_busca_apreensao || input.busca_apreensao) ||
      /busca\s+e\s+apreens[aã]o|reintegra[çc][aã]o\s+de\s+posse/i.test(U),
    transito:
      !!input.datajud_encerrado_tribunal ||
      et.includes('transito') ||
      et.includes('baixa') ||
      /tr[âa]nsito\s+em\s+julgado|transitado\s+em\s+julgado|baixa\s+definitiva/i.test(U),
    arquivamento: /arquiv/i.test(U),
    extinçãoSemMerito:
      /julgo\s+extinto|extinto\s+o\s+processo|extin[çc][aã]o\s+do\s+processo|aus[êe]ncia\s+de\s+pressupostos|cancelamento\s+da\s+distribui[çc][aã]o|sem\s+resolu[çc][aã]o\s+do\s+m[eé]rito|sem\s+julgamento\s+do\s+m[eé]rito/i.test(
        U
      ),
    art485: /artigo\s+485|art\.?\s*485|485,\s*inciso/i.test(U),
    emendaInicial: /emenda\s+[àa]\s+inicial|emendar\s+a\s+inicial/i.test(U),
    numopede: /numopede|demandas?\s+repetitivas|demandas?\s+predat/i.test(U),
    gratuidadeIndeferida:
      /justi[çc]a\s+gratuita:\s*indeferida|gratuidade.{0,20}indefer|n[aã]o\s+sendo\s+a\s+parte\s+autora\s+benefici[aá]ria/i.test(
        U
      ),
    custasMencionadas,
    custasCobradas,
    custasPagas,
    valorPago: custasPagas ? extractValorPago(U) : null,
    dataPagamento: custasPagas ? extractDataPagamento(U) : null,
    procedenteParcial:
      /procedente\s+em\s+parte|julgo\s+procedente\s+em\s+parte|parcialmente\s+procedente/i.test(U),
    procedente:
      /julgo\s+procedente(?!\s+em\s+parte)/i.test(U) && !/improcedente|em\s+parte/i.test(U),
    improcedente: et === 'sentenca_improcedente' || /improcedente|julgo\s+improcedente/i.test(U),
    compensacao: /compensa[çc][aã]o|encontro\s+de\s+contas|artigo\s+368/i.test(U),
    seguroPrestamista: /seguro\s+prestamista|tarifa\s+de\s+seguro/i.test(U),
    documentosNovos:
      /juntada\s+de\s+documentos|documentos?\s+novos?|vistas.{0,30}document/i.test(U),
    audiencia: et.includes('audiencia') || /audi[êe]ncia/i.test(U),
    cumprimento:
      !!input.em_cumprimento_sentenca ||
      et.includes('cumprimento') ||
      /cumprimento\s+de\s+senten[çc]a/i.test(U),
    liminar: /liminar|tutela\s+de\s+urg[êe]ncia/i.test(U),
    intimacaoPrazo: /intime-se|prazo\s+de\s+\d+\s+dias|manifestar-se/i.test(U),
    prazoDias: (() => {
      const m = U.match(/(?:prazo\s+de|em)\s+(\d+)\s*\(?\s*dias?/i);
      return m ? m[1] : null;
    })(),
  };
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
      quandoUsar: 'B.A. / reintegração',
      texto: msg([
        `Olá, ${nome}! Tudo bem?`,
        ``,
        `Preciso te passar uma atualização importante sobre o processo nº ${cnj}.`,
        ``,
        `Identificamos um andamento que pode indicar medida de busca e apreensão (ou similar). Nossa equipe já está avaliando o teor e as medidas cabíveis.`,
        ``,
        `Por segurança, mantenha o bem resguardado e aguarde nosso contato com orientações objetivas.`,
        ``,
        `Qualquer dúvida urgente, responda esta mensagem.`,
      ]),
    });
  }

  // ——— 1. Extinção SEM mérito (caso Darlan) — prioridade alta
  if (s.extinçãoSemMerito || (s.art485 && (s.transito || s.arquivamento))) {
    const valorLine = s.custasPagas
      ? s.valorPago
        ? `A boa notícia é que o sistema do tribunal já registrou o pagamento da taxa judiciária (${s.valorPago}${s.dataPagamento ? `, em ${s.dataPagamento}` : ''}) e a baixa correspondente. Ou seja, você não possui pendência financeira ativa no tribunal por essa guia.`
        : `A boa notícia é que o sistema do tribunal já registrou o pagamento da taxa judiciária e a baixa. Ou seja, você não possui pendência financeira ativa no tribunal por essa cobrança.`
      : s.custasCobradas
        ? `Em razão do encerramento, o juiz determinou o recolhimento da taxa judiciária. Nossa equipe está acompanhando essa pendência para orientar o que for necessário — sem adiantar cobrança indevida a você.`
        : null;

    out.push({
      categoria: 'baixa',
      titulo: 'Extinção sem julgamento do mérito',
      quandoUsar: 'Art. 485 / ausência de pressupostos / cancelamento da distribuição',
      texto: msg([
        `Olá, ${nome}! Tudo bem?`,
        ``,
        `Entro em contato para trazer o parecer objetivo sobre o processo nº ${cnj}.`,
        ``,
        `O juiz encerrou este processo ainda na fase inicial, por uma questão formal de documentação — e não porque tenha julgado o problema de fundo (o “mérito”) a favor ou contra você.`,
        ``,
        s.numopede || s.emendaInicial
          ? `O tribunal passou a exigir documentação de segurança mais rígida (por exemplo, declaração de próprio punho e comprovantes de renda) para seguir com o pedido de justiça gratuita. Como o prazo se esgotou sem o envio completo desses dados, o processo foi extinto.`
          : `Isso costuma ocorrer quando faltam documentos ou requisitos que o juiz exige no início. O processo foi extinto sem analisar o direito material em si.`,
        ``,
        valorLine ||
          (s.gratuidadeIndeferida
            ? `A gratuidade de justiça não foi concedida neste caso; por isso pode haver cobrança de taxa judiciária conforme a decisão.`
            : `Estamos conferindo se restou alguma providência administrativa no tribunal.`),
        ``,
        `O que isso significa agora? Houve trânsito em julgado / finalização dessa ação. Como o juiz não julgou o mérito, você não “perdeu” o direito material só por esse encerramento formal. Se fizer sentido no futuro, uma nova ação pode ser avaliada — desde que a documentação exigida esteja completa desde o início.`,
        ``,
        `Se ficar com qualquer dúvida sobre esse desfecho, nossa equipe segue à disposição.`,
      ]),
    });
  }

  // ——— 2. Trânsito + custas PAGAS (sem extinção já tratada)
  if (
    (s.transito || s.arquivamento) &&
    s.custasPagas &&
    !s.extinçãoSemMerito &&
    out.length < 3
  ) {
    out.push({
      categoria: 'baixa',
      titulo: 'Trânsito — custas quitadas',
      quandoUsar: 'Trânsito com boleto pago / baixa de guia',
      texto: msg([
        `Olá, ${nome}! Tudo bem?`,
        ``,
        `Atualização sobre o processo nº ${cnj}.`,
        ``,
        `Consta trânsito em julgado (ou baixa): a fase de discussão do mérito nesta ação está encerrada.`,
        ``,
        s.valorPago
          ? `Sobre as custas: o tribunal já registrou o pagamento${s.valorPago ? ` (${s.valorPago})` : ''} e a baixa da guia. Não há pendência financeira ativa dessa cobrança no sistema.`
          : `Sobre as custas: o tribunal já registrou o pagamento e a baixa da guia. Não há pendência financeira ativa dessa cobrança no sistema.`,
        ``,
        `Se surgir qualquer ato residual, te aviso de forma objetiva. Qualquer dúvida, estou à disposição.`,
      ]),
    });
  }

  // ——— 3. Trânsito + custas AINDA pendentes (só se NÃO pagas)
  if (
    (s.transito || s.arquivamento) &&
    s.custasCobradas &&
    !s.custasPagas &&
    !s.extinçãoSemMerito &&
    out.length < 3
  ) {
    out.push({
      categoria: 'baixa',
      titulo: 'Trânsito — custas em aberto',
      quandoUsar: 'Trânsito com cobrança de taxa ainda sem pagamento no corpus',
      texto: msg([
        `Olá, ${nome}! Tudo bem?`,
        ``,
        `Trazendo uma atualização sobre o processo nº ${cnj}.`,
        ``,
        `Tivemos o trânsito em julgado (ou baixa): a decisão final sobre o mérito desta ação foi tomada e não cabem mais recursos nesse ponto.`,
        ``,
        `Ainda aparece no tribunal orientação de recolhimento de taxa/custas. Nossa equipe está conferindo o status exato da guia para te orientar com segurança — sem gerar cobrança indevida.`,
        ``,
        `Por enquanto, você não precisa agir até nossa confirmação. Qualquer dúvida, responda esta mensagem.`,
      ]),
    });
  }

  // ——— 4. Trânsito simples (sem custas no radar)
  if (
    (s.transito || s.arquivamento) &&
    !s.custasMencionadas &&
    !s.extinçãoSemMerito &&
    out.length < 3
  ) {
    out.push({
      categoria: 'baixa',
      titulo: 'Trânsito / arquivamento',
      quandoUsar: 'Trânsito sem menção forte a custas',
      texto: msg([
        `Olá, ${nome}! Tudo bem?`,
        ``,
        `Passando para te atualizar sobre o processo nº ${cnj}.`,
        ``,
        `Consta trânsito em julgado ou baixa definitiva. A fase de discussão do mérito nesta ação está encerrada no tribunal.`,
        ``,
        `Estamos só confirmando se existe alguma pendência residual administrativa. Se não houver, o acompanhamento desta ação se encerra; se houver, te avisamos de forma objetiva.`,
        ``,
        `Qualquer dúvida, estamos à disposição.`,
      ]),
    });
  }

  // ——— 5. Procedente parcial + compensação
  if (s.procedenteParcial && (s.compensacao || s.seguroPrestamista) && out.length < 3) {
    out.push({
      categoria: 'merito',
      titulo: 'Decisão parcial + encontro de contas',
      quandoUsar: 'Procedente em parte com compensação',
      texto: msg([
        `Olá, ${nome}! Tudo bem?`,
        ``,
        `Trazendo uma atualização importante sobre o processo nº ${cnj}.`,
        ``,
        `O juiz acolheu em parte o pedido. ${
          s.seguroPrestamista
            ? 'Foi reconhecida cobrança indevida de taxa (seguro prestamista), com devolução nos termos da sentença.'
            : 'Há reconhecimento parcial de valores indevidos, nos termos da decisão.'
        }`,
        ``,
        s.compensacao
          ? `Na prática, o juiz pode ter autorizado “encontro de contas”: o valor reconhecido pode abater dívida do contrato, e não necessariamente cair como depósito na sua conta.`
          : `Os valores e a forma de cumprimento ainda passam por conferência.`,
        ``,
        `Assim que tivermos os números objetivos, te retorno. Qualquer dúvida, estamos à disposição!`,
      ]),
    });
  }

  // ——— 6. Improcedente
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
        `Houve uma decisão que não acolheu o pedido principal. Nossa equipe está lendo o teor completo e avaliando se cabe recurso ou outra medida.`,
        ``,
        `Por enquanto você não precisa comparecer a lugar nenhum. Em breve te retorno com a orientação clara.`,
        ``,
        `Qualquer dúvida, responda esta mensagem.`,
      ]),
    });
  }

  // ——— 7. Audiência / cumprimento / liminar / docs
  if (s.audiencia && out.length < 3) {
    out.push({
      categoria: 'merito',
      titulo: 'Audiência',
      quandoUsar: 'Audiência designada',
      texto: msg([
        `Olá, ${nome}! Tudo bem?`,
        ``,
        `Identificamos audiência no processo nº ${cnj}.`,
        ``,
        `Nossa equipe está organizando os próximos passos e te orienta com data e o que você precisa fazer — se for necessário comparecer. Não se desloque sem nossa confirmação.`,
        ``,
        `Qualquer dúvida, estou à disposição.`,
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
        `O processo nº ${cnj} avançou para a fase de cumprimento da decisão (valores e forma de pagar/descontar).`,
        ``,
        `Estamos revisando os atos e os números com cuidado. Assim que houver próximo passo claro, te retorno.`,
      ]),
    });
  }

  // ——— Fallback
  if (out.length === 0) {
    const temNovidade =
      input.tem_novo_andamento ||
      input.tem_atualizacao_pos_retorno ||
      input.djen_nova_comunicacao ||
      (input.movimentos && input.movimentos.length > 0);

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
            `Por enquanto você não precisa fazer nada. Assim que tivermos orientação objetiva, te retorno.`,
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

// evita tree-shake unused catalog warning em alguns builds
void SCRIPT_CATALOG;

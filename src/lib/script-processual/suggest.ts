/**
 * MOTOR LEXIS (scripts fixos) v15.0
 * Só este motor é determinístico. Grok/Groq/outras IAs NÃO devem ser forçadas a isto.
 *
 * Correções:
 * - R$ 24.000 de RENDA do cônjuge ≠ custas
 * - Intimação de custas ao RÉU/BANCO ≠ cobrança ao cliente
 * - AJG do autor → cliente isento
 * - Cancelamento da distribuição (art. 290) após não pagar custas iniciais → processo extinto, sem dívida absurda
 * - Cumprimento de sentença / intimação ao executado = boa notícia
 *
 * @copyright 2026 Davi Alves Figueredo / W1 Capital Assessoria Financeira Ltda.
 */

import { parseISO, parse, isValid, format } from 'date-fns';
import { SCRIPT_CATALOG, ScriptTemplate } from './catalog';

export interface ScriptSuggestion {
  id?: string;
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
  datajud_ultimo_nome?: string | null;
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
    input.datajud_ultimo_nome || '',
    ...(input.djenTexts || []),
    ...(input.movimentos || []).map(
      (m) => `${m.nome || ''} ${m.complemento || ''} ${m.descricao || ''} ${m.dataHora || ''}`
    ),
  ].join('\n');
}

function msg(lines: string[]): string {
  return lines.filter((l) => l != null).join('\n');
}

/**
 * Extrai valor de CUSTAS apenas se o R$ estiver em janela de taxa/guia/UFESP/DARE,
 * e NÃO em contexto de renda/salário/cônjuge/empresário.
 */
function extractValorCustas(U: string): string | null {
  const re = /R\$\s*([\d.]+,\d{2})/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(U)) !== null) {
    const start = Math.max(0, m.index - 80);
    const end = Math.min(U.length, m.index + m[0].length + 80);
    const window = U.slice(start, end);
    if (
      /renda|sal[aá]rio|mensal|c[oô]njuge|esposa|marido|empres[aá]ri|faturamento|proventos|vencimentos/i.test(
        window
      )
    ) {
      continue; // renda ≠ custas (caso Josiane R$ 24.000)
    }
    if (
      /custa|taxa\s+judici|guia|ufesp|dare|recolh|boleto|preparo|fedtj|c[oó]digo\s+\d+/i.test(
        window
      )
    ) {
      return `R$ ${m[1]}`;
    }
  }
  return null;
}

function extractPrazoDias(U: string): string | null {
  const m = U.match(/prazo\s+de\s+(\d+)\s*\(?\s*dias?/i);
  return m ? m[1] : null;
}

type Signals = {
  ba: boolean;
  baixaDefinitiva: boolean;
  transito: boolean;
  arquivamento: boolean;
  extinçãoSemMerito: boolean;
  cancelamentoDistribuicao: boolean;
  sobPenaCancelamento: boolean;
  processoCanceladoArquivado: boolean;
  art290: boolean;
  art485: boolean;
  gratuidadeCliente: boolean;
  gratuidadeIndeferida: boolean;
  /** Custas cobradas DO CLIENTE (autor) */
  custasDoCliente: boolean;
  /** Custas cobradas DO RÉU / banco / parte requerida */
  custasDoReu: boolean;
  custasPagas: boolean;
  valorCustas: string | null;
  prazoDias: string | null;
  cumprimentoIniciado: boolean;
  intimacaoExecutado: boolean;
  procedenteParcial: boolean;
  improcedente: boolean;
  compensacao: boolean;
  audiencia: boolean;
};

function detectSignals(U: string, input: ScriptInput): Signals {
  const et = String(input.evento_tipo || input.eventoTipo || '').toLowerCase();

  const custasPagas =
    /boleto\s+pago|registro\s+de\s+pagamento|pagamento\s+confirmado|certid[aã]o\s+de\s+pagamento\s+de\s+custas|guia.{0,30}paga/i.test(
      U
    );

  // Destinatário da cobrança
  const custasDoReu =
    /parte\(s\)\s+requerida|parte\s+requerida|intimação\s+da\(s\)\s+parte\(s\)\s+requerida|intimação.{0,40}r[eé]u|r[eé]u.{0,40}pagamento\s+das\s+custas|banco\s+\w+.{0,60}pagamento\s+das\s+custas|executado\(a\)s?.{0,40}pago\s+o\s+valor|intimado\(a\)s?.{0,50}executado/i.test(
      U
    ) ||
    (/pagamento\s+das\s+custas\s+em\s+aberto/i.test(U) &&
      /requerida|r[eé]u|banco\s+\w+|votorantim|ita[uú]|santander|bradesco/i.test(U));

  const custasDoCliente =
    !custasDoReu &&
    !custasPagas &&
    (/custas?\s+processuais?\s+em\s+aberto|efetue\s+o\s+pagamento\s+das\s+custas|intimação\s+da\(s\)\s+parte\(s\)\s+requerente|parte\s+autora.{0,40}pagamento|recolhimento\s+das\s+custas\s+judiciais|primeira\s+parcela\s+das\s+custas|taxa\s+judici[aá]ria.{0,40}requerente/i.test(
      U
    ) ||
      (/custas\s+em\s+aberto|recolher\s+as\s+custas|pagamento\s+taxa\s+judici|guia\s+gerada|juntada.{0,20}guia|ato\s+ordinat[oó]rio.{0,80}guia/i.test(U) &&
        !/requerida|r[eé]u\b/i.test(U)));

  // "sob pena de cancelamento" ≠ cancelamento efetivo
  const sobPenaCancelamento =
    /sob\s+pena\s+(de\s+)?cancelamento|pena\s+de\s+cancelamento\s+da\s+distribui/i.test(U);
  const corpusSemPena = U.replace(
    /[^.!\n]*sob\s+pena\s+(de\s+)?cancelamento[^.!\n]*/gi,
    ' '
  );
  const cancelamentoDistribuicao =
    !sobPenaCancelamento &&
    /cancelamento\s+da\s+distribui[çc][aã]o|cancelada\s+a\s+distribui[çc][aã]o|foi\s+cancelad[ao]\s+a\s+distribui|determino\s+o\s+cancelamento\s+da\s+distribui/i.test(
      corpusSemPena
    );
  const art290 =
    /art\.?\s*290|artigo\s+290/i.test(corpusSemPena) && !sobPenaCancelamento;
  const extinçãoSemMerito =
    /julgo\s+extinto|extinto\s+o\s+processo|extin[çc][aã]o\s+do\s+processo|sem\s+resolu[çc][aã]o\s+do\s+m[eé]rito|aus[êe]ncia\s+de\s+pressupostos|indeferida\s+a\s+peti[çc][aã]o\s+inicial|art\.?\s*485/i.test(
      U
    );

  // Após cancelamento da distribuição por inadimplemento de custas INICIAIS + trânsito/baixa:
  // não inventar cobrança residual de "dívida ativa" com valor de renda
  const processoCanceladoArquivado =
    (cancelamentoDistribuicao || art290) &&
    (extinçãoSemMerito ||
      /tr[âa]nsito\s+em\s+julgado|baixa\s+definitiva|ao\s+arquivo|arquiv/i.test(U));

  const gratuidadeCliente =
    /benefici[aá]ri[oa]\s+da\s+gratuidade|justi[çc]a\s+gratuita\s+(?:deferida|concedida)|gratuidade\s+(?:deferida|concedida|mantida)|sem\s+custas,?\s+ante\s+a\s+gratuidade|isento\s+de\s+recolher\s+preparo|autor\s+fica\s+isento/i.test(
      U
    );

  return {
    ba:
      !!(input.indicio_busca_apreensao || input.busca_apreensao) ||
      (/(?:a[cç][aã]o|mandado|liminar|deferid[ao]|conced[oa]|cumprimento\s+do\s+mandado)\s+de\s+busca\s+e\s+apreens/i.test(
        U
      ) &&
        !/jurisprud[eê]ncia|s[uú]mula|neste\s+sentido|conforme\s+entendimento|cita[cç][aã]o\s+doutrin/i.test(U)),
    baixaDefinitiva: /baixa\s+definitiva/i.test(U),
    transito:
      !!input.datajud_encerrado_tribunal ||
      /tr[âa]nsito\s+em\s+julgado|transitado\s+em\s+julgado/i.test(U),
    arquivamento: /arquiv/i.test(U),
    extinçãoSemMerito,
    cancelamentoDistribuicao,
    sobPenaCancelamento,
    processoCanceladoArquivado,
    art290,
    art485: /art\.?\s*485|artigo\s+485/i.test(U),
    gratuidadeCliente,
    gratuidadeIndeferida:
      /indefero\s+o\s+pedido\s+de\s+justi[çc]a\s+gratuita|gratuidade.{0,20}indefer/i.test(U),
    // Se processo já cancelado/arquivado por art 290, NÃO tratar como custas urgentes do cliente
    custasDoCliente:
      custasDoCliente && !processoCanceladoArquivado && !gratuidadeCliente && !custasDoReu,
    custasDoReu,
    custasPagas,
    valorCustas: extractValorCustas(U),
    prazoDias: extractPrazoDias(U),
    cumprimentoIniciado:
      !!input.em_cumprimento_sentenca ||
      /cumprimento\s+de\s+senten[çc]a\s+iniciada|execu[çc][aã]o\/cumprimento\s+de\s+senten[çc]a\s+iniciada|dado\s+in[ií]cio\s+ao\s+cumprimento/i.test(
        U
      ),
    intimacaoExecutado:
      /executado\(a\)s?.{0,60}pago\s+o\s+valor|intimado.{0,40}executado|multa\s+legal\s+e\s+honor[aá]rios/i.test(
        U
      ),
    procedenteParcial: /procedente\s+em\s+parte|parcialmente\s+procedente/i.test(U),
    improcedente: /improcedente|julgo\s+improcedente/i.test(U),
    compensacao: /compensa[çc][aã]o|encontro\s+de\s+contas/i.test(U),
    audiencia: /audi[êe]ncia/i.test(U),
  };
}

export function suggestScripts(input: ScriptInput): ScriptSuggestion[] {
  const nome = firstName(input.clienteNome);
  const cnj = input.protocolo || 'seu processo';
  const U = buildCorpus(input);
  const s = detectSignals(U, input);
  const out: ScriptSuggestion[] = [];

  if (s.ba) {
    out.push({
      id: 'ba',
      categoria: 'ba',
      titulo: 'Alerta: busca e apreensão',
      quandoUsar: 'B.A.',
      texto: msg([
        `Olá, ${nome}! Tudo bem?`,
        ``,
        `Atualização importante sobre o processo nº ${cnj}.`,
        ``,
        `Há andamento que pode indicar medida de busca e apreensão. Nossa equipe já está avaliando as medidas cabíveis.`,
        ``,
        `Por segurança, mantenha o bem resguardado e aguarde nosso contato com orientações objetivas.`,
      ]),
    });
  }

  // ——— Cumprimento / intimação ao BANCO (boa notícia) — Alessandro execução
  if (s.cumprimentoIniciado || (s.custasDoReu && s.intimacaoExecutado)) {
    out.push({
      id: 'cumprimento_positivo',
      categoria: 'execucao',
      titulo: 'Cumprimento de sentença em andamento',
      quandoUsar: 'Execução iniciada / intimação ao réu',
      texto: msg([
        `Olá, ${nome}! Tudo bem?`,
        ``,
        `Boas notícias sobre o processo nº ${cnj}.`,
        ``,
        s.cumprimentoIniciado
          ? `A fase de cumprimento de sentença (cobrança do que foi definido na ação) já foi iniciada. O juiz intimou a parte contrária a cumprir a obrigação no prazo legal.`
          : `Há intimação dirigida à parte contrária nesta fase.`,
        ``,
        s.custasDoReu
          ? `Sobre taxas do tribunal: a cobrança de custas que aparece nos autos é de responsabilidade da parte adversa — não sua.`
          : `Você não precisa pagar custas do tribunal por essa movimentação.`,
        ``,
        `Nossa equipe monitora prazos e depósitos. Qualquer novidade objetiva, te avisamos.`,
      ]),
    });
  }

  // ——— Custas cobradas do RÉU (não assustar o cliente) — Alessandro
  if (s.custasDoReu && !s.cumprimentoIniciado && out.length < 3) {
    out.push({
      id: 'custas_reu',
      categoria: 'custas',
      titulo: 'Custas a cargo da parte contrária',
      quandoUsar: 'Intimação de custas ao réu/banco',
      texto: msg([
        `Olá, ${nome}! Tudo bem?`,
        ``,
        `Atualização sobre o processo nº ${cnj}.`,
        ``,
        `O tribunal publicou intimação de custas processuais${s.valorCustas ? ` (${s.valorCustas})` : ''}.`,
        ``,
        `Essa cobrança é de responsabilidade da parte contrária (réu/banco), não sua.`,
        s.gratuidadeCliente
          ? `Você é beneficiário(a) da justiça gratuita e não precisa recolher essa taxa.`
          : `Você não precisa pagar esse valor ao tribunal.`,
        ``,
        `Não há risco de inscrição do seu CPF por essa intimação. Seguimos acompanhando o processo.`,
      ]),
    });
  }

  // ——— Cancelamento distribuição / extinção art 290 — Josiane (SEM inventar R$ 24k)

  // ——— Intimação de custas sob pena de cancelamento (ainda NÃO cancelou)
  if (
    /sob\s+pena\s+(de\s+)?cancelamento|junte.{0,40}comprovante\s+de\s+pagamento\s+das\s+custas|suspenda-se\s+o\s+feito.{0,80}custas/i.test(U) &&
    !s.cancelamentoDistribuicao &&
    !s.processoCanceladoArquivado &&
    out.length < 3
  ) {
    const prazo = s.prazoDias ? `${s.prazoDias} dias` : 'o prazo indicado no despacho';
    out.push({
      id: 'custas_sob_pena_cancelamento',
      categoria: 'custas',
      titulo: 'URGENTE: custas iniciais sob pena de cancelamento',
      quandoUsar: 'Despacho intimando autor a recolher custas, sob pena de art. 290',
      texto: msg([
        `Olá, ${nome}! Tudo bem?`,
        ``,
        `Atualização importante sobre o processo nº ${cnj}.`,
        ``,
        `O juiz determinou o recolhimento das custas iniciais e intimou a parte autora a juntar o comprovante no prazo de ${prazo}, sob pena de cancelamento da distribuição (encerramento formal do processo sem julgamento do mérito).`,
        ``,
        `Ainda não se trata de cancelamento definitivo: há prazo em curso. É essencial regularizar a guia oficial do tribunal dentro do prazo para o processo seguir.`,
        ``,
        `Nossa equipe pode orientar a emissão/conferência do boleto. Responda esta mensagem para alinharmos.`,
      ]),
    });
  }


  if (
    (s.cancelamentoDistribuicao || s.art290 || s.extinçãoSemMerito) &&
    (s.transito || s.baixaDefinitiva || s.arquivamento || s.extinçãoSemMerito) &&
    out.length < 3
  ) {
    out.push({
      id: 'cancelamento_distribuicao',
      categoria: 'baixa',
      titulo: 'Cancelamento da distribuição / extinção formal',
      quandoUsar: 'Art. 290 / 485 — processo baixado sem mérito',
      texto: msg([
        `Olá, ${nome}! Tudo bem?`,
        ``,
        `Parecer conclusivo sobre o processo nº ${cnj}.`,
        ``,
        `O processo foi encerrado de forma formal (cancelamento da distribuição / extinção sem julgamento do mérito), em regra após ausência de recolhimento das custas iniciais no prazo. O mérito da disputa com a outra parte não foi decidido neste processo.`,
        ``,
        `O que isso significa na prática? Este processo específico foi baixado em definitivo. Você não possui pendência financeira ativa nem dívida de custas inventada com o tribunal por valores de renda ou outros números que apareçam só como contexto na decisão.`,
        ``,
        `Como o mérito não foi julgado, você não “perdeu” o direito material só por esse encerramento formal. Se no futuro fizer sentido uma nova ação, as custas iniciais precisarão ser observadas desde o começo.`,
        ``,
        `Qualquer dúvida sobre esse desfecho, nossa equipe está à disposição.`,
      ]),
    });
  }

  // ——— Custas URGENTES do CLIENTE (só se realmente for autor/requerente e processo não cancelado)
  if (s.custasDoCliente && out.length < 3) {
    const valor = s.valorCustas || 'o valor indicado na intimação';
    const prazo = s.prazoDias ? `${s.prazoDias} dias` : 'o prazo da intimação';
    out.push({
      id: 'custas_cliente_urgente',
      categoria: 'custas',
      titulo: 'URGENTE: custas do autor em aberto',
      quandoUsar: 'Intimação de pagamento ao requerente',
      texto: msg([
        `Olá, ${nome}! Tudo bem?`,
        ``,
        `Atualização importante sobre o processo nº ${cnj}.`,
        ``,
        `Há intimação para pagamento de custas processuais em aberto (${valor}), no prazo de ${prazo}.`,
        ``,
        `É importante regularizar a guia oficial do tribunal para evitar inscrição na Dívida Ativa.`,
        ``,
        `Nossa equipe pode orientar a emissão/conferência do boleto. Responda esta mensagem para alinharmos o pagamento.`,
      ]),
    });
  }

  // ——— AJG + baixa
  if (s.gratuidadeCliente && (s.baixaDefinitiva || s.transito) && out.length < 3) {
    out.push({
      id: 'ajg_baixa',
      categoria: 'baixa',
      titulo: 'Baixa com gratuidade',
      quandoUsar: 'Cliente com AJG',
      texto: msg([
        `Olá, ${nome}! Tudo bem?`,
        ``,
        `Atualização sobre o processo nº ${cnj}.`,
        ``,
        `O processo consta com baixa/arquivamento. Você é beneficiário(a) da justiça gratuita, o que em regra isenta do recolhimento de custas processuais.`,
        ``,
        `Se aparecer intimação de taxa, confira se é dirigida à parte contrária — nesse caso você não paga. Seguimos acompanhando.`,
      ]),
    });
  }

  if (s.procedenteParcial && s.compensacao && out.length < 3) {
    out.push({
      id: 'parcial_compensacao',
      categoria: 'merito',
      titulo: 'Procedente em parte',
      quandoUsar: 'Mérito parcial',
      texto: msg([
        `Olá, ${nome}! Tudo bem?`,
        ``,
        `Atualização sobre o processo nº ${cnj}.`,
        ``,
        `O juiz acolheu em parte o pedido. Pode haver encontro de contas (valor reconhecido abatendo dívida do contrato), e não necessariamente depósito na conta.`,
        ``,
        `Assim que os números estiverem objetivos, te retorno.`,
      ]),
    });
  }


  // ——— Apelação / Tema STJ / intimação para manifestar
  if (
    /tema\s*1378|afetação|ambas\s+as\s+partes|manifestarem|contrarraz[oõ]es|apela[cç][aã]o|embargos\s+de\s+declara[cç][aã]o|parcialmente\s+procedente|seguro\s+prestamista/i.test(
      U
    ) &&
    out.length < 3
  ) {
    const prazo = extractPrazoDias(U);
    out.push({
      id: 'recurso_manifestacao',
      categoria: 'recurso',
      titulo: 'Recurso / prazo para se manifestar',
      quandoUsar: 'Apelação, tema STJ, contrarrazões, embargos',
      texto: msg([
        `Olá, ${nome}! Tudo bem?`,
        ``,
        `Atualização importante sobre o processo nº ${cnj}.`,
        ``,
        /tema\s*1378|afetação/i.test(U)
          ? `O tribunal intimou as partes para se manifestarem porque há tema do STJ (afetação) relacionado a este tipo de demanda${prazo ? `, no prazo de ${prazo} dias` : ''}.`
          : /contrarraz/i.test(U)
            ? `Há intimação relacionada a contrarrazões de apelação${prazo ? ` (prazo de ${prazo} dias)` : ''}.`
            : /parcialmente\s+procedente|seguro\s+prestamista/i.test(U)
              ? `Há decisão que reconheceu em parte pedidos (ex.: abusividade de cobranças como seguro prestamista). O processo segue em grau de recurso/acompanhamento.`
              : `Houve movimentação em grau de recurso ou despacho para manifestação das partes.`,
        ``,
        `Nossa equipe está analisando o teor e os prazos. Assim que houver orientação objetiva, te retorno.`,
        ``,
        `Qualquer dúvida, responda esta mensagem.`,
      ]),
    });
  }

  if (out.length === 0) {
    const temNovidade =
      input.tem_novo_andamento ||
      input.tem_atualizacao_pos_retorno ||
      input.djen_nova_comunicacao ||
      (input.movimentos && input.movimentos.length > 0);
    out.push({
      id: 'fallback',
      categoria: 'andamento',
      titulo: temNovidade ? 'Atualização' : 'Acompanhamento',
      quandoUsar: 'Sem classificação forte',
      texto: msg([
        `Olá, ${nome}! Tudo bem?`,
        ``,
        temNovidade
          ? `Houve movimentação no processo nº ${cnj}. Nossa equipe está conferindo o teor completo antes de qualquer conclusão.`
          : `Seguimos acompanhando o processo nº ${cnj}.`,
        ``,
        `Qualquer novidade objetiva, te aviso.`,
      ]),
    });
  }

  return out.slice(0, 3);
}

/** Alias pedido por script-processual.ts */
export function gerarSugestoesScript(input: ScriptInput): ScriptSuggestion[] {
  return suggestScripts(input);
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
    id: s.id,
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

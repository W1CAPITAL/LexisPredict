/**
 * e-SAJ Crawler (portado do jus_crawler)
 * Suporta TJSP (26), TJAL (02) e TJCE (06)
 * @copyright Adaptado para LexisPredict
 */

import * as cheerio from 'cheerio';

const REQUEST_TIMEOUT_MS = 30000;
const REQUEST_RETRIES = 3;
const REQUEST_RETRY_DELAY_MS = 1000;

const TRIBUNAIS: Record<string, { nome: string; dominio: string }> = {
  '02': { nome: 'TJAL', dominio: 'www2.tjal.jus.br' },
  '06': { nome: 'TJCE', dominio: 'esaj.tjce.jus.br' },
  '26': { nome: 'TJSP', dominio: 'esaj.tjsp.jus.br' },
};

export interface Parte {
  nome: string;
  tipoParticipacao: string;
  advogados: string[];
}

export interface Movimentacao {
  data: string;
  descricao: string;
}

export interface DadosGrau {
  classe?: string;
  area?: string;
  assunto?: string;
  data?: string;
  juiz?: string;
  valor?: string;
  partes?: Parte[];
  movimentações?: Movimentacao[];
  ERROR?: string;
}

export interface EsaJResult {
  id: string;
  'Primeiro Grau'?: DadosGrau;
  'Segundo Grau'?: DadosGrau;
}

function cleanData(data: string | null | undefined): string {
  if (!data) return '';
  return data
    .replace(/\n/g, ' ')
    .replace(/&nbsp;?/g, ' ')
    .replace(/\t/g, ' ')
    .replace(/\r/g, '')
    .replace(/\xa0/g, '')
    .replace(/None/g, '')
    .replace(/ +/g, ' ')
    .trim();
}

function parseCNJ(cnj: string) {
  const clean = cnj.replace(/\D/g, '');
  if (clean.length !== 20) throw new Error('CNJ deve ter 20 dígitos');

  // Formato CNJ: NNNNNNN-DD.AAAA.J.TR.OOOO
  const formatado = `${clean.slice(0, 7)}-${clean.slice(7, 9)}.${clean.slice(9, 13)}.${clean.slice(13, 14)}.${clean.slice(14, 16)}.${clean.slice(16)}`;
  const parts = formatado.split('.');

  return {
    numero_processo: formatado,
    numeroDigitoAnoUnificado: `${parts[0]}.${parts[1]}`,
    foro: clean.slice(-4), // últimos 4 dígitos
    tribunal: parts[3], // TR
  };
}

async function sendRequest(url: string): Promise<cheerio.CheerioAPI | { ERROR: string }> {
  let lastError: string | null = null;

  for (let attempt = 1; attempt <= REQUEST_RETRIES; attempt++) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

      const res = await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        },
      });
      clearTimeout(timeout);

      if (res.status >= 500) {
        lastError = `HTTP ${res.status}`;
        if (attempt < REQUEST_RETRIES) await new Promise(r => setTimeout(r, REQUEST_RETRY_DELAY_MS));
        continue;
      }

      const html = await res.text();
      const $ = cheerio.load(html);

      const msgErro = $('#mensagemRetorno li').first().text();
      if (msgErro) {
        return { ERROR: cleanData(msgErro) };
      }

      return $;
    } catch (err: any) {
      lastError = err.name === 'AbortError' ? 'Timeout' : err.message;
      if (attempt < REQUEST_RETRIES) await new Promise(r => setTimeout(r, REQUEST_RETRY_DELAY_MS));
    }
  }

  return { ERROR: lastError || 'Falha ao consultar o processo' };
}

function getPartes($: cheerio.CheerioAPI): Parte[] {
  let rows = $('#tableTodasPartes tr');
  if (rows.length === 0) rows = $('#tablePartesPrincipais tr');

  const partes: Parte[] = [];
  rows.each((_, el) => {
    const nomesRaw = cleanData($(el).find('.nomeParteEAdvogado').text());
    const tipo = cleanData($(el).find('.tipoDeParticipacao').text());
    if (!nomesRaw) return;

    const split = nomesRaw.split(/ Advogado: | Advogada: /i);
    const nome = cleanData(split[0]);
    const advogados = split.slice(1).map(a => cleanData(a)).filter(Boolean);

    partes.push({ nome, tipoParticipacao: tipo, advogados });
  });
  return partes;
}

function getMovimentos($: cheerio.CheerioAPI, grau: 1 | 2): Movimentacao[] {
  const tags = grau === 1
    ? { container: '.containerMovimentacao', data: 'dataMovimentacao', descricao: 'descricaoMovimentacao' }
    : { container: '.movimentacaoProcesso', data: 'dataMovimentacaoProcesso', descricao: 'descricaoMovimentacaoProcesso' };

  const movs: Movimentacao[] = [];
  $(tags.container).each((_, el) => {
    const data = cleanData($(el).find(`.${tags.data}`).text());
    const descricao = cleanData($(el).find(`.${tags.descricao}`).text());
    if (data || descricao) {
      movs.push({ data, descricao: descricao.replace(/\s+/g, ' ') });
    }
  });
  return movs;
}

function parseData($: cheerio.CheerioAPI): DadosGrau {
  return {
    classe: cleanData($('#classeProcesso').text()),
    area: cleanData($('#areaProcesso').text()),
    assunto: cleanData($('#assuntoProcesso').text()),
    data: cleanData($('#dataHoraDistribuicaoProcesso').text()).slice(0, 10),
    juiz: cleanData($('#juizProcesso').text()),
    valor: cleanData($('#valorAcaoProcesso').text()),
    partes: getPartes($),
  };
}

async function buscaPrimeiroGrau(processo: ReturnType<typeof parseCNJ>, dominio: string): Promise<DadosGrau> {
  const url = `https://${dominio}/cpopg/search.do?conversationId=&cbPesquisa=NUMPROC` +
    `&numeroDigitoAnoUnificado=${processo.numeroDigitoAnoUnificado}` +
    `&foroNumeroUnificado=${processo.foro}` +
    `&dadosConsulta.valorConsultaNuUnificado=${processo.numero_processo}` +
    `&dadosConsulta.valorConsultaNuUnificado=UNIFICADO&dadosConsulta.valorConsulta=` +
    `&dadosConsulta.tipoNuProcesso=UNIFICADO`;

  const html = await sendRequest(url);
  if ('ERROR' in html) return html as DadosGrau;

  const data = parseData(html);
  data.movimentações = getMovimentos(html, 1);
  return data;
}

async function buscaCodigoSegundoGrau(url: string): Promise<string> {
  const html = await sendRequest(url);
  if ('ERROR' in html) return '';
  return html('#processoSelecionado').attr('value') || '';
}

async function buscaSegundoGrau(processo: ReturnType<typeof parseCNJ>, dominio: string): Promise<DadosGrau> {
  let url = `https://${dominio}/cposg5/search.do?cbPesquisa=NUMPROC` +
    `&numeroDigitoAnoUnificado=${processo.numeroDigitoAnoUnificado}` +
    `&foroNumeroUnificado=${processo.foro}` +
    `&dePesquisaNuUnificado=${processo.numero_processo}` +
    `&dePesquisaNuUnificado=UNIFICADO&dePesquisa=&tipoNuProcesso=UNIFICADO`;

  const codigo = await buscaCodigoSegundoGrau(url);
  if (codigo) {
    url = `https://${dominio}/cposg5/show.do?processo.codigo=${codigo}`;
  }

  const html = await sendRequest(url);
  if ('ERROR' in html) return html as DadosGrau;

  const data = parseData(html);
  data.movimentações = getMovimentos(html, 2);
  return data;
}

/**
 * Função principal – use esta no LexisPredict
 */
export async function fetchEsaJProcess(cnj: string): Promise<EsaJResult | null> {
  try {
    const processo = parseCNJ(cnj);
    const tribunalInfo = TRIBUNAIS[processo.tribunal];
    if (!tribunalInfo) return null; // só processa TJSP/TJAL/TJCE

    const [grau1, grau2] = await Promise.all([
      buscaPrimeiroGrau(processo, tribunalInfo.dominio),
      buscaSegundoGrau(processo, tribunalInfo.dominio),
    ]);

    const result: EsaJResult = { id: processo.numero_processo };

    if (grau1.classe || grau1.ERROR) result['Primeiro Grau'] = grau1;
    if (grau2.classe || grau2.ERROR) result['Segundo Grau'] = grau2;

    return result;
  } catch (err: any) {
    console.error('[e-SAJ Crawler]', err.message);
    return null;
  }
}

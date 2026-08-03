/**
 * e-SAJ Crawler - versão melhorada
 * - Remove movimentações duplicadas
 * - Detecta menções a custas
 * - Limpeza de texto aprimorada
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
  isCustas?: boolean;
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
  custasDetectadas?: string[];
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

  const formatado = `${clean.slice(0, 7)}-${clean.slice(7, 9)}.${clean.slice(9, 13)}.${clean.slice(13, 14)}.${clean.slice(14, 16)}.${clean.slice(16)}`;
  const parts = formatado.split('.');

  return {
    numero_processo: formatado,
    numeroDigitoAnoUnificado: `${parts[0]}.${parts[1]}`,
    foro: clean.slice(-4),
    tribunal: parts[3],
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
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        },
      });
      clearTimeout(timeout);

      if (res.status >= 500) {
        lastError = `HTTP ${res.status}`;
        if (attempt < REQUEST_RETRIES) await new Promise((r) => setTimeout(r, REQUEST_RETRY_DELAY_MS));
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
      if (attempt < REQUEST_RETRIES) await new Promise((r) => setTimeout(r, REQUEST_RETRY_DELAY_MS));
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
    const advogados = split.slice(1).map((a) => cleanData(a)).filter(Boolean);

    partes.push({ nome, tipoParticipacao: tipo, advogados });
 

import { perfCached, PerfKeys } from '@/lib/performance-motor';
import { detectarAudienciaPendente } from './audiencia-detect';
/**
 * @fileOverview Motor de Consulta e Higiene DJEN v8.6 — PROTOCOLO BRASIL (gru1)
 * API oficial: https://comunicaapi.pje.jus.br/api/v1/comunicacao
 * @copyright 2026 Davi Alves Figueredo / W1 Capital Assessoria Financeira Ltda.
 */

export interface DjenComunicacao {
  id: number | string;
  hash?: string;
  data_disponibilizacao: string | null;
  siglaTribunal: string | null;
  tipoComunicacao: string | null;
  nomeOrgao: string | null;
  texto: string | null;
  numero_processo: string | null;
  meio: string | null;
  link: string | null;
  tipoDocumento: string | null;
  nomeClasse: string | null;
  /** Destinatários / partes quando o tribunal envia na API */
  destinatarios?: Array<{ nome?: string; polo?: string; advogados?: string[]; numeroDocumentoPrincipal?: string; numeroDocumento?: string; cpf?: string; cnpj?: string; documento?: string }>;
}


/** Monta URL do diario oficial quando a API nao envia `link`. */
export function resolveDjenPublicacaoLink(
  item: Partial<DjenComunicacao> | null | undefined,
  protocolo?: string | null
): string | null {
  if (!item && !protocolo) return null;
  const direct = item?.link ? String(item.link).trim() : '';
  if (direct.startsWith('http')) return direct;
  const hash = item?.hash ? String(item.hash).trim() : '';
  if (hash) return `https://comunica.pje.jus.br/consulta?hash=${encodeURIComponent(hash)}`;
  const id = item?.id != null ? String(item.id).trim() : '';
  if (id) return `https://comunica.pje.jus.br/consulta?id=${encodeURIComponent(id)}`;
  const digits = String(protocolo || item?.numero_processo || '').replace(/\D/g, '');
  if (digits.length === 20) {
    const masked = `${digits.slice(0, 7)}-${digits.slice(7, 9)}.${digits.slice(9, 13)}.${digits.slice(13, 14)}.${digits.slice(14, 16)}.${digits.slice(16, 20)}`;
    return `https://comunica.pje.jus.br/#/consulta?numeroProcesso=${encodeURIComponent(masked)}`;
  }
  return null;
}

export interface DjenFetchResult {
  success: boolean;
  error?: string;
  isRateLimited?: boolean;
  isGeoBlocked?: boolean;
  count: number;
  items: DjenComunicacao[];
}

const DJEN_URL = 'https://comunicaapi.pje.jus.br/api/v1/comunicacao';

/**
 * Decodifica entidades HTML (nomeadas + numéricas + hex).
 * Roda em loop curto para capturar dupla codificação (&amp;ndash; → –).
 */
export function decodeHtmlEntities(input: string): string {
  if (!input) return "";
  const named: Record<string, string> = {
    nbsp: " ",
    amp: "&",
    lt: "<",
    gt: ">",
    quot: '"',
    apos: "'",
    ndash: "–",
    mdash: "—",
    hellip: "…",
    sect: "§",
    deg: "°",
    ordm: "º",
    ordf: "ª",
    // minúsculas
    aacute: "á",
    eacute: "é",
    iacute: "í",
    oacute: "ó",
    uacute: "ú",
    agrave: "à",
    egrave: "è",
    igrave: "ì",
    ograve: "ò",
    ugrave: "ù",
    atilde: "ã",
    otilde: "õ",
    ntilde: "ñ",
    acirc: "â",
    ecirc: "ê",
    icirc: "î",
    ocirc: "ô",
    ucirc: "û",
    auml: "ä",
    euml: "ë",
    iuml: "ï",
    ouml: "ö",
    uuml: "ü",
    ccedil: "ç",
    // maiúsculas
    Aacute: "Á",
    Eacute: "É",
    Iacute: "Í",
    Oacute: "Ó",
    Uacute: "Ú",
    Agrave: "À",
    Egrave: "È",
    Igrave: "Ì",
    Ograve: "Ò",
    Ugrave: "Ù",
    Atilde: "Ã",
    Otilde: "Õ",
    Ntilde: "Ñ",
    Acirc: "Â",
    Ecirc: "Ê",
    Icirc: "Î",
    Ocirc: "Ô",
    Ucirc: "Û",
    Auml: "Ä",
    Euml: "Ë",
    Iuml: "Ï",
    Ouml: "Ö",
    Uuml: "Ü",
    Ccedil: "Ç",
    ldquo: "“",
    rdquo: "”",
    lsquo: "‘",
    rsquo: "’",
    laquo: "«",
    raquo: "»",
    bull: "•",
    middot: "·",
    times: "×",
    divide: "÷",
    euro: "€",
    real: "R$",
  };

  let s = String(input);
  for (let pass = 0; pass < 3; pass++) {
    const prev = s;
    s = s.replace(/&([a-zA-Z]+);/g, (m, name) =>
      Object.prototype.hasOwnProperty.call(named, name) ? named[name] : m
    );
    s = s.replace(/&#(\d+);/g, (_, n) => {
      const code = Number(n);
      if (!Number.isFinite(code) || code < 0 || code > 0x10ffff) return _;
      try {
        return String.fromCodePoint(code);
      } catch {
        return _;
      }
    });
    s = s.replace(/&#x([0-9a-fA-F]+);/g, (_, h) => {
      const code = parseInt(h, 16);
      if (!Number.isFinite(code) || code < 0 || code > 0x10ffff) return _;
      try {
        return String.fromCodePoint(code);
      } catch {
        return _;
      }
    });
    if (s === prev) break;
  }
  return s;
}

/**
 * HTML bruto / texto com entidades → texto puro legível (DJEN, PDF, scripts).
 */
export function plainTextFromDjen(html: string): string {
  if (!html) return "";
  let s = String(html)
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<head[\s\S]*?<\/head>/gi, "")
    .replace(/<\/(p|div|tr|br|li|h[1-6]|section|article|table|thead|tbody)>/gi, "\n")
    .replace(/<(br|hr)\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ");

  s = decodeHtmlEntities(s);

  // Lixo residual de entidades / tags quebradas
  s = s
    .replace(/&[a-zA-Z]+;/g, " ")
    .replace(/&#\d+;/g, " ")
    .replace(/&#x[0-9a-fA-F]+;/g, " ")
    .replace(/\u00a0/g, " ")
    .replace(/\s+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();

  // Quebras legíveis em decisões longas
  s = s
    .replace(/\s+(?=\d+\.\s)/g, "\n\n")
    .replace(/\s+(?=Art\.\s)/gi, "\n")
    .replace(/\s+(?=DESPACHO\/DECIS)/gi, "\n\n")
    .replace(/\s+(?=Vistos,?)/gi, "\n\n")
    .replace(/\s+(?=Intimem-se\.?)/gi, "\n\n")
    .replace(/\s+(?=INTIME-SE)/gi, "\n\n")
    .replace(/\s+(?=Portanto,?)/gi, "\n\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return s;
}

/**
 * Resumo operacional em prosa (compatibilidade).
 */
export function summarizeDjenForAlert(plainText: string, type?: string): string {
  if (!plainText) return 'Publicação oficial sem conteúdo legível.';
  const upper = plainText.toUpperCase();

  if (/(EXTINÇÃO|EXTINTO|485|290|CANCELAMENTO DA DISTRIBUIÇÃO)/.test(upper)) {
    return 'RITO DE EXTINÇÃO: Identificada sentença de extinção ou cancelamento da distribuição.';
  }
  if (/(EMENDA|EMENDE|ADITE|ADITAMENTO)/.test(upper)) {
    return 'EMENDA À INICIAL: Juiz determinou adequação ou aditamento da petição inicial.';
  }
  if (/(AJG|GRATUIDADE|HIPOSSUFICIÊNCIA|REGISTRATO)/.test(upper)) {
    return 'COMPROVAÇÃO AJG: Intimação referente ao benefício de Justiça Gratuita.';
  }
  if (/(REDISTRIBUIÇÃO|DECLÍNIO|INCOMPETÊNCIA)/.test(upper)) {
    return 'REDISTRIBUIÇÃO: Processo movido para nova vara ou declínio de competência.';
  }
  if (/(TRÂNSITO|BAIXA DEFINITIVA|ARQUIVAMENTO)/.test(upper)) {
    return 'BAIXA/TRÂNSITO: Publicação confirma o encerramento definitivo do caso.';
  }
  return `Publicação DJEN (${type || 'Comunicação'}): ` + plainText.substring(0, 180).trim() + '...';
}

/**
 * Keywords curtas para tarefas / notificações / capa (máx. 3 tags).
 */
export function summarizeDjenKeywords(raw: string | null | undefined): string {
  const plain = plainTextFromDjen(String(raw || ''));
  if (!plain) return 'Publicação no Diário Oficial';

  const upper = plain.toUpperCase();
  // Prefer descriptive phrases over cryptic tags (operator readability)
  if (/(TRÂNSITO\s+EM\s+JULGADO)/.test(upper)) return 'Trânsito em julgado';
  if (/(BAIXA\s+DEFINITIVA|ARQUIVAMENTO)/.test(upper)) return 'Baixa definitiva / arquivamento';
  if (/(EXTINÇÃO|EXTINTO|EXTINGU|ART\.?\s*485|CANCELAMENTO\s+DA\s+DISTRIBUIÇÃO)/.test(upper)) {
    return 'Extinção / cancelamento da distribuição';
  }
  if (/(PARCIALMENTE\s+PROCEDENTE|PROCEDÊNCIA\s+PARCIAL)/.test(upper)) return 'Sentença parcialmente procedente';
  if (/(SENTENÇA).*(IMPROCEDENTE)|IMPROCEDENTE/.test(upper)) return 'Sentença improcedente';
  if (/(SENTENÇA).*(PROCEDENTE)|JULGADO\s+PROCEDENTE/.test(upper) && !/IMPROCEDENTE/.test(upper)) {
    return 'Sentença procedente';
  }
  if (/(SENTENÇA|JULGO)/.test(upper)) return 'Sentença / decisão de mérito';
  if (/(CUMPRIMENTO\s+DE\s+SENTENÇA|EXECUÇÃO\s+DE\s+SENTENÇA)/.test(upper)) return 'Cumprimento de sentença';
  if (/(AUDIÊNCIA\s+DE\s+CONCILIAÇÃO|AUDIÊNCIA\s+DE\s+MEDIAÇÃO)/.test(upper)) return 'Audiência de conciliação/mediação';
  if (/(AUDIÊNCIA\s+DE\s+INSTRUÇÃO)/.test(upper)) return 'Audiência de instrução';
  if (detectarAudienciaPendente(upper).isAudienciaPendente) return detectarAudienciaPendente(upper).resumo || 'Audiência designada';
  if (/(LIMINAR|TUTELA\s+DE\s+URGÊNCIA|ANTECIPAÇÃO\s+DE\s+TUTELA)/.test(upper)) return 'Liminar / tutela de urgência';
  if (/(AJG|JUSTIÇA\s+GRATUITA|GRATUIDADE|HIPOSSUFICI)/.test(upper)) return 'Justiça gratuita (AJG)';
  if (/(CUSTAS|TAXAS?\s+JUDICI[AÁ]RIAS|PREPARO)/.test(upper)) return 'Custas / preparo';
  if (/(EMENDA|EMENDE|ADITE|ADITAMENTO)/.test(upper)) return 'Emenda à inicial';
  if (/(REDISTRIBUIÇÃO|DECLÍNIO|INCOMPETÊNCIA)/.test(upper)) return 'Redistribuição / declínio';
  if (/(INTIMAÇÃO|INTIMADO|CIÊNCIA)/.test(upper)) return 'Intimação / ciência';
  if (/(DESPACHO|DETERMINO)/.test(upper)) return 'Despacho / determinação';
  // Fallback: first ~120 chars of clean text
  const short = plain.replace(/\s+/g, ' ').trim().substring(0, 120);
  return short ? short + (plain.length > 120 ? '…' : '') : 'Publicação no Diário Oficial';
}

/** Nunca devolve JSON cru na UI operacional. */
export function resumoHumanoDjen(raw: unknown): string {
  if (raw == null) return '';
  let text = '';
  if (typeof raw === 'string') {
    const t = raw.trim();
    if (t.startsWith('{') || t.startsWith('[')) {
      try {
        const obj = JSON.parse(t);
        const item = Array.isArray(obj) ? obj[0] : obj;
        text = String(item?.texto || item?.conteudo || item?.mensagem || item?.resumo || '');
        if (!text) return summarizeDjenKeywords(JSON.stringify(item));
      } catch {
        text = t;
      }
    } else {
      text = t;
    }
  } else if (typeof raw === 'object') {
    const item = raw as any;
    text = String(item?.texto || item?.conteudo || item?.mensagem || item?.resumo || '');
  }
  return summarizeDjenForAlert(plainTextFromDjen(text), undefined);
}

/**
 * Classificação de mérito a partir do texto da comunicação.
 */
export function classifyEventFromText(
  text: string | null | undefined
): { tipo: string; label: string } {
  const upper = plainTextFromDjen(String(text || '')).toUpperCase();
  if (!upper) return { tipo: 'rotina', label: 'Rotina' };

  // BA desativado — nunca classifica como busca e apreensão

  if (/(TRÂNSITO\s+EM\s+JULGADO|BAIXA\s+DEFINITIVA|ARQUIVAMENTO|EXTINÇÃO|EXTINTO|CANCELAMENTO\s+DA\s+DISTRIBUIÇÃO)/.test(upper)) {
    return { tipo: 'transito_ou_baixa', label: 'Trânsito / Baixa' };
  }
  if (/(SENTENÇA).*(IMPROCEDENTE)|IMPROCEDENTE/.test(upper)) {
    return { tipo: 'sentenca_improcedente', label: 'Sentença Improcedente' };
  }
  if (/(SENTENÇA).*(PROCEDENTE)|PROCEDENTE/.test(upper) && !/IMPROCEDENTE/.test(upper)) {
    return { tipo: 'sentenca_procedente', label: 'Sentença Procedente' };
  }
  if (/(PARCIALMENTE\s+PROCEDENTE|PROCEDÊNCIA\s+PARCIAL)/.test(upper)) {
    return { tipo: 'sentenca_parcial', label: 'Sentença Parcial' };
  }
  if (/(CUMPRIMENTO\s+DE\s+SENTENÇA|EXECUÇÃO\s+DE\s+SENTENÇA)/.test(upper)) {
    return { tipo: 'cumprimento_sentenca', label: 'Cumprimento de Sentença' };
  }
  if (/(LIMINAR|TUTELA\s+DE\s+URGÊNCIA|ANTECIPAÇÃO\s+DE\s+TUTELA)/.test(upper)) {
    return { tipo: 'liminar', label: 'Liminar / Tutela' };
  }
  if (/(AUDIÊNCIA\s+DE\s+JULGAMENTO)/.test(upper)) {
    return { tipo: 'audiencia_julgamento', label: 'Audiência de Julgamento' };
  }
  if (/(AUDIÊNCIA\s+DE\s+INSTRUÇÃO)/.test(upper)) {
    return { tipo: 'audiencia_instrucao', label: 'Audiência de Instrução' };
  }
  if (/(AUDIÊNCIA\s+DE\s+CONCILIAÇÃO|AUDIÊNCIA\s+DE\s+MEDIAÇÃO)/.test(upper)) {
    return { tipo: 'audiencia_conciliacao', label: 'Audiência de Conciliação' };
  }
  if (/(CANCELAMENTO\s+DA\s+DISTRIBUIÇÃO)/.test(upper)) {
    return { tipo: 'cancelamento_distribuicao', label: 'Cancelamento da Distribuição' };
  }

  // Intimação / despacho com prazo (ex.: documentos de justiça gratuita)
  const temIntima = /(INTIMA[CÇ][AÃ]O|INTIMADO|INTIMEM-SE|CI[EÊ]NCIA)/.test(upper);
  const temJG = /(JUSTI[CÇ]A\s+GRATUITA|GRATUIDADE\s+DA\s+JUSTI[CÇ]A|ASSIST[EÊ]NCIA\s+JUDICI[AÁ]RIA)/.test(upper);
  const temPrazoDocs = /(PRAZO\s+DE\s+\d+|ASSINO\s+[AÀ]\s+PARTE|APRESENTE\(M\)|DECLARA[CÇ][OÕ]ES\s+DE\s+BENS|EXTRATOS\s+BANC[AÁ]RIOS)/.test(upper);
  const temCustas = /(CUSTAS|PREPARO|RECOLHIMENTO|DESER[CÇ][AÃ]O|GUIA\s+OFICIAL)/.test(upper);
  const temDespacho = /(DESPACHO\/DECIS|DESPACHO|DETERMINO)/.test(upper);

  if (temIntima && temJG && temPrazoDocs) {
    return { tipo: 'intimacao_justica_gratuita', label: 'Intimação — Justiça Gratuita (prazo docs)' };
  }
  if (temIntima && temCustas) {
    return { tipo: 'intimacao_custas', label: 'Intimação — Custas / Preparo' };
  }
  if (temIntima && temPrazoDocs) {
    return { tipo: 'intimacao_prazo', label: 'Intimação com prazo' };
  }
  if (temIntima || (temDespacho && temPrazoDocs)) {
    return { tipo: 'intimacao', label: 'Intimação / Despacho' };
  }
  if (temCustas) {
    return { tipo: 'custas', label: 'Custas / Preparo' };
  }
  if (temDespacho) {
    return { tipo: 'despacho', label: 'Despacho / Decisão' };
  }

  // Remessa / publicação sem conteúdo de mérito = rotina de cartório
  if (/^(REMESSA|PUBLICA[CÇ][AÃ]O|DISPONIBILIZA|RECEBIMENTO|EXPEDI[CÇ][AÃ]O|ATO\s+ORDINAT|MERO\s+EXPEDIENTE)/.test(upper.slice(0, 80))
    && !temIntima && !temJG && !temCustas) {
    return { tipo: 'rotina', label: 'Monitoramento regular' };
  }

  return { tipo: 'novo_andamento_relevante', label: 'Publicação DJEN' };
}

/**
 * Fetch oficial DJEN — dual CNJ, headers de browser, timeout, empty = success.
 */
export async function fetchDjenComunicacoes(
  protocolo: string,
  opts?: {
    siglaTribunal?: string;
    meio?: 'D' | 'E' | null;
    dataInicio?: string;
    dataFim?: string;
  }
): Promise<DjenFetchResult> {
  const digits = protocolo.replace(/\D/g, '');
  if (digits.length !== 20) {
    return { success: false, error: 'CNJ Inválido (requer 20 dígitos)', count: 0, items: [] };
  }

  const dataFim = opts?.dataFim || new Date().toISOString().split('T')[0];
  const dataInicioEarly =
    opts?.dataInicio ||
    new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const cacheKey = PerfKeys.djen(digits, dataInicioEarly, dataFim) + ':' + (opts?.siglaTribunal || '');
  return perfCached(cacheKey, () => fetchDjenComunicacoesUncached(protocolo, opts), 90_000);
}

async function fetchDjenComunicacoesUncached(
  protocolo: string,
  opts?: {
    siglaTribunal?: string;
    meio?: 'D' | 'E' | null;
    dataInicio?: string;
    dataFim?: string;
  }
): Promise<DjenFetchResult> {
  const digits = protocolo.replace(/\D/g, '');
  if (digits.length !== 20) {
    return { success: false, error: 'CNJ Inválido (requer 20 dígitos)', count: 0, items: [] };
  }

  const dataFim = opts?.dataFim || new Date().toISOString().split('T')[0];
  const dataInicio =
    opts?.dataInicio ||
    new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  const masked = `${digits.substring(0, 7)}-${digits.substring(7, 9)}.${digits.substring(9, 13)}.${digits.substring(13, 14)}.${digits.substring(14, 16)}.${digits.substring(16, 20)}`;
  const cnjOptions = [digits, masked];

  let lastError = '';

  for (const cnj of cnjOptions) {
    try {
      const params = new URLSearchParams({
        numeroProcesso: cnj,
        dataDisponibilizacaoInicio: dataInicio,
        dataDisponibilizacaoFim: dataFim,
        pagina: '1',
        itensPorPagina: '50',
      });

      if (opts?.siglaTribunal && !/^outros$/i.test(opts.siglaTribunal)) {
        params.append('siglaTribunal', opts.siglaTribunal.toUpperCase());
      }
      if (opts?.meio) params.append('meio', opts.meio);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 28000);

      const response = await fetch(`${DJEN_URL}?${params.toString()}`, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          'Accept-Language': 'pt-BR,pt;q=0.9',
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
          Origin: 'https://comunica.pje.jus.br',
          Referer: 'https://comunica.pje.jus.br/',
        },
        signal: controller.signal,
        cache: 'no-store',
      });

      clearTimeout(timeoutId);

      if (response.status === 403) {
        console.error('[DJEN Fetch Fail] 403 geo-block', { cnj, status: 403 });
        return {
          success: false,
          isGeoBlocked: true,
          error:
            'DJEN geo-bloqueou o servidor (403). Região Vercel deve ser gru1 (São Paulo).',
          count: 0,
          items: [],
        };
      }

      if (response.status === 429) {
        console.error('[DJEN Fetch Fail] 429 rate-limit', { cnj });
        return {
          success: false,
          isRateLimited: true,
          error: 'Rate limit DJEN (429). Aguarde 1 minuto.',
          count: 0,
          items: [],
        };
      }

      if (!response.ok) {
        lastError = `HTTP ${response.status}`;
        console.error('[DJEN Fetch Fail]', lastError, { cnj });
        continue;
      }

      const data = await response.json();
      const rawItems = Array.isArray(data.items) ? data.items : [];

      const mappedItems: DjenComunicacao[] = rawItems.map((item: any) => {
        const rawText = String(
          item?.texto ||
          item?.conteudo ||
          item?.textoPublicacao ||
          item?.descricao ||
          item?.inteiroTeor ||
          item?.resumo ||
          ''
        );
        const plainText = plainTextFromDjen(rawText);
        const destRaw = item.destinatarios || item.destinatario || item.partes || [];
        const destList = Array.isArray(destRaw) ? destRaw : [destRaw];
        const destinatarios = destList
          .filter(Boolean)
          .map((d: any) => {
            const numeroDocumentoPrincipal = String(
              d?.numeroDocumentoPrincipal || d?.numerodocumentoprincipal || d?.cpf || d?.cnpj || d?.documento || ''
            )
              .replace(/\D/g, '')
              .trim() || undefined;
            const numeroDocumento = String(
              d?.numeroDocumento || d?.numerodocumento || d?.cpf || d?.cnpj || ''
            )
              .replace(/\D/g, '')
              .trim() || undefined;
            const cpfRaw = String(d?.cpf || d?.numeroDocumentoPrincipal || d?.numeroDocumento || '')
              .replace(/\D/g, '')
              .trim();
            const cnpjRaw = String(d?.cnpj || d?.numeroDocumentoPrincipal || d?.numeroDocumento || '')
              .replace(/\D/g, '')
              .trim();
            return {
              nome: String(d?.nome || d?.nomeDestinatario || d?.razaoSocial || '').trim() || undefined,
              polo: String(d?.polo || d?.tipoPolo || d?.tipo || '').trim() || undefined,
              advogados: Array.isArray(d?.advogados)
                ? d.advogados.map((a: any) => String(a?.nome || a || '').trim()).filter(Boolean)
                : undefined,
              numeroDocumentoPrincipal,
              numeroDocumento,
              cpf: (cpfRaw.length === 11 ? cpfRaw : '') || undefined,
              cnpj: (cnpjRaw.length === 14 ? cnpjRaw : '') || undefined,
              documento: numeroDocumentoPrincipal,
            };
          })
          .filter((d: any) => d.nome);
        return {
          id: item.id || item.comunicacao_id,
          hash: item.hash,
          data_disponibilizacao:
            item.data_disponibilizacao || item.datadisponibilizacao || null,
          siglaTribunal: item.siglaTribunal || item.siglatribunal || null,
          tipoComunicacao: item.tipoComunicacao || item.tipocomunicacao || null,
          nomeOrgao: item.nomeOrgao || item.nomeorgao || null,
          texto: plainText,
          numero_processo:
            item.numeroProcesso || item.numeroprocessocommascara || null,
          meio: item.meio || null,
          link: item.link || (item.hash ? `https://comunica.pje.jus.br/consulta?hash=${item.hash}` : null) || null,
          tipoDocumento: item.tipoDocumento || item.tipodocumento || null,
          nomeClasse: item.nomeClasse || item.nomeclasse || null,
          destinatarios: destinatarios.length ? destinatarios : undefined,
        };
      });

      const enriched = mappedItems.map((it) => ({
        ...it,
        link: resolveDjenPublicacaoLink(it, digits) || it.link,
      }));
      // HTTP 200 com lista vazia = sucesso (processo sem publicação no período)
      return {
        success: true,
        count: data.count ?? enriched.length,
        items: enriched,
      };
    } catch (e: any) {
      if (e?.name === 'AbortError') {
        console.error('[DJEN Fetch Fail] timeout 20s', { cnj });
        return { success: false, error: 'Tempo esgotado no DJEN.', count: 0, items: [] };
      }
      const cause = e?.cause?.code || e?.cause?.message || e?.code || e?.message || String(e);
      lastError = cause;
      console.error('[DJEN Fetch Fail]', cause, { cnj });
    }
  }

  return {
    success: false,
    error: lastError || 'Nenhuma comunicação localizada.',
    count: 0,
    items: [],
  };
}


/** Ordena comunicações DJEN da mais recente para a mais antiga. */
export function sortDjenComunicacoesRecentFirst(input: unknown): any[] {
  const arr = Array.isArray(input) ? [...input] : input ? [input] : [];
  const ts = (x: any): number => {
    const raw =
      x?.data ||
      x?.data_disponibilizacao ||
      x?.dataDisponibilizacao ||
      x?.created_at ||
      x?.dt ||
      "";
    const n = Date.parse(String(raw));
    return Number.isFinite(n) ? n : 0;
  };
  return arr.sort((a, b) => ts(b) - ts(a));
}

/** Textos DJEN do mais recente ao mais antigo (tarefas/whatsapp/cases). */
export function djenTextsRecentFirst(input: unknown): string[] {
  const items = sortDjenComunicacoesRecentFirst(input);
  if (items.length) {
    return items
      .map((it: any) => {
        if (typeof it === "string") return plainTextFromDjen(it);
        const raw =
          it?.texto || it?.text || it?.conteudo || it?.html || it?.mensagem || it?.inteiroTeor || "";
        return plainTextFromDjen(String(raw));
      })
      .filter((s: string) => s && s.trim().length > 0);
  }
  if (typeof input === "string" && input.trim()) return [plainTextFromDjen(input)];
  return [];
}

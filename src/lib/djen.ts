/**
 * @fileOverview Motor de Consulta e Higiene DJEN v8.6 — PROTOCOLO DE PRECISÃO
 * Consulta a API pública do PJe para localizar comunicações oficiais.
 * @copyright 2026 Davi Alves Figueredo / W1 Capital Assessoria Financeira Ltda.
 */

import { EventoTipo } from './case-logic';

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
}

export interface DjenFetchResult {
  success: boolean;
  error?: string;
  isRateLimited?: boolean;
  isGeoBlocked?: boolean;
  count: number;
  items: DjenComunicacao[];
}

/**
 * Consulta a API pública do DJEN (PJe) com timeout e resiliência total.
 * Tenta múltiplos formatos de CNJ e sanitiza o texto na origem.
 */
export async function fetchDjenComunicacoes(
  protocolo: string,
  opts?: {
    siglaTribunal?: string;
    meio?: 'D' | 'E' | null;
    dataInicio?: string;
    dataFim?: string;
  },
  attempt = 1
): Promise<DjenFetchResult> {
  const digits = protocolo.replace(/\D/g, '');
  if (digits.length !== 20) {
    return { success: false, error: 'CNJ Inválido', count: 0, items: [] };
  }

  const dataFim = opts?.dataFim || new Date().toISOString().split('T')[0];
  const dataInicio =
    opts?.dataInicio ||
    new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  const masked = `${digits.slice(0, 7)}-${digits.slice(7, 9)}.${digits.slice(9, 13)}.${digits.slice(13, 14)}.${digits.slice(14, 16)}.${digits.slice(16, 20)}`;
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
      const timeoutId = setTimeout(() => controller.abort(), 15000);

      const response = await fetch(
        `https://comunicaapi.pje.jus.br/api/v1/comunicacao?${params}`,
        {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
            'Accept-Language': 'pt-BR,pt;q=0.9',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
            'Origin': 'https://comunica.pje.jus.br',
            'Referer': 'https://comunica.pje.jus.br/',
          },
          cache: 'no-store',
          signal: controller.signal,
        }
      );
      clearTimeout(timeoutId);

      if (response.status === 429)
        return { success: false, isRateLimited: true, count: 0, items: [] };
      if (response.status === 403)
        return { success: false, isGeoBlocked: true, count: 0, items: [] };
      if (!response.ok) {
        lastError = `HTTP ${response.status}`;
        continue;
      }

      const data = await response.json();
      const rawItems = Array.isArray(data.items) ? data.items : [];

      const items: DjenComunicacao[] = rawItems.map((item: any) => {
        const rawTexto = item.texto || '';
        return {
          id: item.id || item.comunicacao_id,
          hash: item.hash,
          data_disponibilizacao:
            item.data_disponibilizacao ||
            item.dataDisponibilizacao ||
            item.datadisponibilizacao ||
            null,
          siglaTribunal: item.siglaTribunal || item.siglatribunal || null,
          tipoComunicacao: item.tipoComunicacao || item.tipocomunicacao || null,
          nomeOrgao: item.nomeOrgao || item.nomeorgao || null,
          texto: plainTextFromDjen(rawTexto), 
          numero_processo:
            item.numeroProcesso || item.numeroprocessocommascara || null,
          meio: item.meio || null,
          link: item.link || null,
          tipoDocumento: item.tipoDocumento || item.tipodocumento || null,
          nomeClasse: item.nomeClasse || item.nomeclasse || null,
        };
      });

      // HTTP 200 é sucesso, mesmo que a lista venha vazia (sem publicações)
      return {
        success: true,
        count: data.count || items.length,
        items,
      };
      
    } catch (e: any) {
      if (e?.name === 'AbortError') lastError = 'Tempo esgotado no DJEN';
      else lastError = e?.message || 'Erro de conexão';
    }
  }

  // Retry único se falhar totalmente a rede/PJe
  if (attempt < 2) {
    return fetchDjenComunicacoes(protocolo, opts, attempt + 1);
  }

  console.error('[DJEN Fetch Fail]', lastError);
  return { success: false, error: lastError || 'Falha na comunicação DJEN', count: 0, items: [] };
}

/**
 * Converte HTML bruto do DJEN em texto puro legível.
 */
export function plainTextFromDjen(html: string): string {
  if (!html) return "";
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<\/(p|div|tr|br|li|h[1-6]|section|article|td|table)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&ordm;/gi, "º")
    .replace(/&ordf;/gi, "ª")
    .replace(/&amp;/gi, "&")
    .replace(/&iacute;/gi, "í")
    .replace(/&eacute;/gi, "é")
    .replace(/&aacute;/gi, "á")
    .replace(/&atilde;/gi, "ã")
    .replace(/&ccedil;/gi, "ç")
    .replace(/&otilde;/gi, "õ")
    .replace(/&ecirc;/gi, "ê")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/\s+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Motor de Extração de Keywords Críticas v9.0
 * Retorna APENAS keywords curtas para telemetria.
 */
export function summarizeDjenKeywords(raw: string | null | undefined): string {
  const plain = plainTextFromDjen(raw || "").toUpperCase();
  if (!plain.trim()) return "PUBLICAÇÃO DJEN";

  const keywords = [
    { re: /BUSCA\s+E\s+APREEN|APREENSAO\s+DO\s+VE[IÍ]CULO/, label: "BA" },
    { re: /JULG[OA]\s+IMPROCEDENTE|SENTENÇA\s+IMPROCEDENTE/, label: "EXTINÇÃO" },
    { re: /JULG[OA]\s+PROCEDENTE|SENTENÇA\s+PROCEDENTE/, label: "SENTENÇA" },
    { re: /CUSTAS|PREPARO|RECOLHIMENTO|GUIA/, label: "CUSTAS" },
    { re: /JUSTI[CÇ]A\s+GRATUITA|AJG/, label: "AJG" },
    { re: /EMENDA|DETERMINO\s+A\s+EMENDA/, label: "EMENDA" },
    { re: /REDISTRIBUIÇÃO|REDISTRIBUIDO/, label: "REDISTRIBUIÇÃO" },
    { re: /TR[AÂ]NSITO\s+EM\s+JULGADO|BAIXA\s+DEFINITIVA/, label: "TRÂNSITO/BAIXA" },
    { re: /INTIMAÇÃO|INTIME-SE/, label: "INTIMAÇÃO" },
    { re: /DESPACHO|DECISÃO|DECIDO/, label: "DESPACHO" }
  ];

  const hits: string[] = [];
  for (const k of keywords) {
    if (k.re.test(plain)) hits.push(k.label);
    if (hits.length >= 3) break;
  }

  return hits.length > 0 ? hits.join(" | ") : "PUBLICAÇÃO DJEN";
}

/**
 * Classifica a natureza jurídica de um texto.
 */
export function classifyEventFromText(text: string | null | undefined): { tipo: EventoTipo; label: string } {
  if (!text) return { tipo: 'rotina', label: 'ANDAMENTO DE ROTINA' };
  const clean = plainTextFromDjen(text).toUpperCase();

  if (/MANDADO\s+DE\s+BUSCA|BUSCA\s+E\s+APREENS[AÃ]O/.test(clean)) return { tipo: 'ba', label: 'BUSCA E APREENSÃO' };
  if (/BAIXA\s+DEFINITIVA|TR[AÂ]NSITO\s+EM\s+JULGADO/.test(clean)) return { tipo: 'transito_ou_baixa', label: 'BAIXA DEFINITIVA' };
  if (/JULG[OA]\s+IMPROCEDENTE/.test(clean)) return { tipo: 'sentenca_improcedente', label: 'SENTENÇA IMPROCEDENTE' };
  if (/JULG[OA]\s+PROCEDENTE/.test(clean)) return { tipo: 'sentenca_procedente', label: 'SENTENÇA PROCEDENTE' };
  if (/CUMPRIMENTO\s+DE\s+SENTEN/.test(clean)) return { tipo: 'cumprimento_sentenca', label: 'CUMPRIMENTO DE SENTENÇA' };

  return { tipo: 'rotina', label: 'INTIMAÇÃO DE ROTINA' };
}

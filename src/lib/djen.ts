/**
 * @fileOverview Motor de Consulta e Higiene DJEN v7.8 — PROTOCOLO DE PRECISÃO
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
 * Consulta a API pública do DJEN (PJe) com timeout e resiliência.
 */
export async function fetchDjenComunicacoes(
  protocolo: string,
  options: { siglaTribunal?: string; dataInicio?: string; dataFim?: string } = {}
): Promise<DjenFetchResult> {
  const cnjLimpo = protocolo.replace(/\D/g, '');
  const url = 'https://comunicacao.pje.jus.br/api/comunicacao/consultar';
  
  if (cnjLimpo.length !== 20) {
    return { success: false, error: "CNJ Inválido", count: 0, items: [] };
  }

  try {
    const params = new URLSearchParams({
      numeroProcesso: cnjLimpo,
      pagina: '1',
      itensPorPagina: '10'
    });

    if (options.siglaTribunal) params.append('siglaTribunal', options.siglaTribunal);
    if (options.dataInicio) params.append('dataInicio', options.dataInicio);
    if (options.dataFim) params.append('dataFim', options.dataFim);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    const response = await fetch(`${url}?${params.toString()}`, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
      cache: 'no-store',
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (response.status === 429) return { success: false, isRateLimited: true, count: 0, items: [] };
    if (response.status === 403) return { success: false, isGeoBlocked: true, count: 0, items: [] };

    if (!response.ok) throw new Error(`HTTP Error ${response.status}`);

    const data = await response.json();
    const items = (data.items || []).map((item: any) => ({
      id: item.id,
      data_disponibilizacao: item.dataDisponibilizacao,
      siglaTribunal: item.siglaTribunal,
      tipoComunicacao: item.tipoComunicacao,
      nomeOrgao: item.nomeOrgao,
      texto: item.texto,
      numero_processo: item.numeroProcesso,
      meio: item.meio,
      link: `https://comunicacao.pje.jus.br/comunicacao/intermediario/detalhe/${item.id}`,
      tipoDocumento: item.tipoDocumento,
      nomeClasse: item.nomeClasse
    }));

    return {
      success: true,
      count: data.count || items.length,
      items
    };
  } catch (e: any) {
    const isTimeout = e.name === 'AbortError';
    console.error("[DJEN Fetch Fail]", isTimeout ? "Timeout 30s" : e.message);
    return { success: false, error: isTimeout ? "Tempo esgotado (30s)" : e.message, count: 0, items: [] };
  }
}

/**
 * Converte HTML bruto do DJEN em texto puro legível.
 */
export function plainTextFromDjen(html: string): string {
  if (!html) return "";
  let s = html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<head[\s\S]*?<\/head>/gi, "")
    .replace(/<\/(p|div|tr|br|li|h[1-6]|section|article|td|table)>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&ordm;/gi, "º")
    .replace(/&ordf;/gi, "ª")
    .replace(/&iacute;/gi, "í")
    .replace(/&Iacute;/gi, "Í")
    .replace(/&eacute;/gi, "é")
    .replace(/&Eacute;/gi, "É")
    .replace(/&aacute;/gi, "á")
    .replace(/&Aacute;/gi, "Á")
    .replace(/&atilde;/gi, "ã")
    .replace(/&Atilde;/gi, "Ã")
    .replace(/&otilde;/gi, "õ")
    .replace(/&Otilde;/gi, "Õ")
    .replace(/&ccedil;/gi, "ç")
    .replace(/&Ccedil;/gi, "Ç")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&ndash;/gi, "-")
    .replace(/&mdash;/gi, "—")
    .replace(/\s+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
  return s;
}

/**
 * Classifica a natureza jurídica de um texto (DataJud ou DJEN).
 */
export function classifyEventFromText(text: string | null | undefined): { tipo: EventoTipo; label: string } {
  if (!text) return { tipo: 'rotina', label: 'ANDAMENTO DE ROTINA' };
  
  const clean = plainTextFromDjen(text).toUpperCase();

  if (/MANDADO\s+DE\s+BUSCA|EXPEDI[ÇC][AÃ]O\s+DE\s+MANDADO\s+DE\s+BUSCA|BUSCA\s+E\s+APREENS[AÃ]O\s+DEFERIDA/.test(clean)) {
    return { tipo: 'ba', label: 'BUSCA E APREENSÃO' };
  }

  if (/BAIXA\s+DEFINITIVA|PROCESSO\s+BAIXADO|DETERMINADA\s+A\s+BAIXA|ARQUIVADO\s+DEFINITIVAMENTE|TR[AÂ]NSITO\s+EM\s+JULGADO/.test(clean)) {
    return { tipo: 'transito_ou_baixa', label: 'BAIXA DEFINITIVA' };
  }

  if (/(POSTO\s+ISTO|DISPOSITIVO|DECIDO).*IMPROCEDENTE|JULG[OA]\s+IMPROCEDENTE|TOTALMENTE\s+IMPROCEDENTE/.test(clean)) {
    return { tipo: 'sentenca_improcedente', label: 'SENTENÇA IMPROCEDENTE' };
  }
  
  if (/(POSTO\s+ISTO|DISPOSITIVO|DECIDO).*PROCEDENTE\s+EM\s+PARTE|PARCIALMENTE\s+PROCEDENTE|JULG[OA]\s+PARCIALMENTE\s+PROCEDENTE/.test(clean)) {
    return { tipo: 'sentenca_parcial', label: 'PROCEDENTE EM PARTE' };
  }

  if (/(POSTO\s+ISTO|DISPOSITIVO|DECIDO).*PROCEDENTE|JULG[OA]\s+PROCEDENTE|TOTALMENTE\s+PROCEDENTE/.test(clean)) {
    return { tipo: 'sentenca_procedente', label: 'SENTENÇA PROCEDENTE' };
  }

  if (/LIMINAR\s+DEFERIDA|TUTELA\s+DEFERIDA|TUTELA\s+CONCEDIDA|CONCEDO\s+A\s+LIMINAR|AUTORIZO\s+O\s+DEP[OÓ]SITO/.test(clean)) {
    return { tipo: 'liminar', label: 'LIMINAR DEFERIDA' };
  }

  if (/CUMPRIMENTO\s+DE\s+SENTEN|EXECU[CÇ][AÃ]O\s+DE\s+SENTEN/.test(clean)) {
    return { tipo: 'cumprimento_sentenca', label: 'CUMPRIMENTO DE SENTENÇA' };
  }

  return { tipo: 'rotina', label: 'INTIMAÇÃO DE ROTINA' };
}

/**
 * Motor de Extração de Keywords Críticas v8.2
 */
export function summarizeDjenKeywords(raw: string | null | undefined): string {
  const plain = plainTextFromDjen(raw || "").toUpperCase();
  if (!plain.trim()) return "PUBLICAÇÃO DJEN";

  const rules: { re: RegExp; label: string }[] = [
    { re: /BUSCA\s+E\s+APREEN|APREENSAO\s+DO\s+VE[IÍ]CULO|ALIENA[CÇ][AÃ]O\s+FIDUCI[AÁ]RIA.*APREEN/, label: "BUSCA E APREENSÃO" },
    { re: /INDEFIRO\s+A\s+TUTELA|LIMINAR\s+INDEFERIDA|N[AÃ]O\s+CONCEDO\s+A\s+TUTELA|INDEFERIR\s+A\s+LIMINAR/, label: "LIMINAR INDEFERIDA" },
    { re: /TUTELA\s+DEFERIDA|LIMINAR\s+CONCEDIDA|CONCEDO\s+A\s+TUTELA|ANTECIPAÇÃO\s+DEFERIDA/, label: "LIMINAR DEFERIDA" },
    { re: /AUTORIZO\s+O\s+DEP[OÓ]SITO|AUTORIZA-SE\s+O\s+DEP[OÓ]SITO|AUTORIZO\s+A\s+CONSIGNA[ÇC][AÃ]O/, label: "DEPÓSITO AUTORIZADO" },
    { re: /BAIXA\s+DEFINITIVA|PROCESSO\s+BAIXADO|DETERMINADA\s+A\s+BAIXA/, label: "BAIXA DEFINITIVA" },
    { re: /TR[AÂ]NSITO\s+EM\s+JULGADO/, label: "TRÂNSITO EM JULGADO" },
    { re: /JULG[OA]\s+IMPROCEDENTE|TOTALMENTE\s+IMPROCEDENTE|SENTENÇA\s+IMPROCEDENTE/, label: "SENTENÇA IMPROCEDENTE" },
    { re: /JULG[OA]\s+PROCEDENTE|TOTALMENTE\s+PROCEDENTE|SENTENÇA\s+PROCEDENTE/, label: "SENTENÇA PROCEDENTE" },
    { re: /CUMPRIMENTO\s+DE\s+SENTEN|EXECU[CÇ][AÃ]O\s+DE\s+SENTEN/, label: "CUMPRIMENTO DE SENTENÇA" },
    { re: /JUSTI[CÇ]A\s+GRATUITA|AJG|ASSIST[EÊ]NCIA\s+JUDICI[AÁ]RIA/, label: "AJG" },
    { re: /CUSTAS|PREPARO|RECOLHIMENTO|UFESP/, label: "CUSTAS" },
    { re: /CONTESTA[CÇ][AÃ]O/, label: "CONTESTAÇÃO" },
    { re: /AUDI[EÊ]NCIA/, label: "AUDIÊNCIA" },
    { re: /RECURSO|APELA[CÇ][AÃ]O|AGRAVO/, label: "RECURSO" },
  ];

  const hits: string[] = [];
  const lowerPlain = plain.toLowerCase();
  const indexDispositivo = Math.max(lowerPlain.lastIndexOf("decido"), lowerPlain.lastIndexOf("posto isto"), lowerPlain.lastIndexOf("julgo"));
  const relevantText = indexDispositivo !== -1 ? plain.substring(indexDispositivo) : plain;

  for (const r of rules) {
    if (r.re.test(relevantText)) {
      if (!hits.includes(r.label)) hits.push(r.label);
    } else if (r.re.test(plain)) {
      if (["BUSCA E APREENSÃO", "BAIXA DEFINITIVA", "TRÂNSITO EM JULGADO", "AJG"].includes(r.label)) {
        if (!hits.includes(r.label)) hits.push(r.label);
      }
    }
    if (hits.length >= 4) break; 
  }

  if (hits.length === 0) {
    const tipo = plain.slice(0, 40).replace(/\s+/g, " ").trim();
    return tipo ? `DJEN · ${tipo}…` : "PUBLICAÇÃO DJEN";
  }

  return hits.join(" · ");
}
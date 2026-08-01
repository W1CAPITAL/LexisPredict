/**
 * @fileOverview Motor de Consulta e Higiene DJEN v7.6 — PROTOCOLO UNIFICADO
 * Consulta a API pública do PJe para localizar comunicações oficiais.
 * Inclui motor de classificação mútua, sanitização agressiva e detecção de geo-bloqueio.
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
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/\s+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
  return s;
}

/**
 * Classifica a natureza jurídica de um texto (DataJud ou DJEN).
 * Garante exclusividade de mérito (Nunca Procedente e Improcedente juntos).
 */
export function classifyEventFromText(text: string | null | undefined): { tipo: EventoTipo; label: string } {
  if (!text) return { tipo: 'rotina', label: 'ANDAMENTO DE ROTINA' };
  
  const raw = text.toUpperCase();
  const clean = plainTextFromDjen(raw);

  // 1. PRIORIDADE MÁXIMA: BUSCA E APREENSÃO (FOCADO EM MANDADO/DEFERIMENTO)
  if (/MANDADO\s+DE\s+BUSCA|EXPEDI[ÇC][AÃ]O\s+DE\s+MANDADO\s+DE\s+BUSCA|BUSCA\s+E\s+APREENS[AÃ]O\s+DEFERIDA/.test(clean)) {
    return { tipo: 'ba', label: 'BUSCA E APREENSÃO' };
  }

  // 2. BAIXA E TRÂNSITO (TERMINATIVO)
  if (/BAIXA\s+DEFINITIVA|PROCESSO\s+BAIXADO|DETERMINADA\s+A\s+BAIXA|ARQUIVADO\s+DEFINITIVAMENTE|TR[AÂ]NSITO\s+EM\s+JULGADO/.test(clean)) {
    return { tipo: 'transito_ou_baixa', label: 'BAIXA DEFINITIVA' };
  }

  // 3. SENTENÇAS (MÉRITO EXCLUSIVO - EXIGE DISPOSITIVO)
  if (/POSTO\s+ISTO.*IMPROCEDENTE|JULGO\s+IMPROCEDENTE/.test(clean)) {
    return { tipo: 'sentenca_improcedente', label: 'SENTENÇA IMPROCEDENTE' };
  }
  
  if (/POSTO\s+ISTO.*PROCEDENTE\s+EM\s+PARTE|PARCIALMENTE\s+PROCEDENTE/.test(clean)) {
    return { tipo: 'sentenca_parcial', label: 'PROCEDENTE EM PARTE' };
  }

  if (/POSTO\s+ISTO.*PROCEDENTE(?!\s+EM\s+PARTE)|JULGO\s+PROCEDENTE(?!\s+EM\s+PARTE)/.test(clean)) {
    return { tipo: 'sentenca_procedente', label: 'SENTENÇA PROCEDENTE' };
  }

  // 4. RITOS DE URGÊNCIA (DISTINGUE DEFERIDO DE INDEFERIDO)
  if (/LIMINAR\s+DEFERIDA|TUTELA\s+DEFERIDA|TUTELA\s+CONCEDIDA|CONCEDO\s+A\s+LIMINAR/.test(clean)) {
    return { tipo: 'liminar', label: 'LIMINAR DEFERIDA' };
  }
  if (/INDEFIRO\s+A\s+TUTELA|LIMINAR\s+INDEFERIDA|N[AÃ]O\s+CONCEDO\s+A\s+TUTELA/.test(clean)) {
    return { tipo: 'novo_andamento_relevante', label: 'LIMINAR INDEFERIDA' };
  }

  // 5. AUDIÊNCIAS GRANULARES
  if (/AUDI[EÊ]NCIA\s+DE\s+CONCILIA[CÇ][AÃ]O|CEJUSC|CONCILIADORA/.test(clean)) {
    return { tipo: 'audiencia_conciliacao', label: 'AUDIÊNCIA DE CONCILIAÇÃO' };
  }
  if (/AUDI[EÊ]NCIA\s+DE\s+INSTRU[CÇ][AÃ]O/.test(clean)) {
    return { tipo: 'audiencia_instrucao', label: 'AUDIÊNCIA DE INSTRUÇÃO' };
  }
  if (/AUDI[EÊ]NCIA\s+DE\s+JULGAMENTO/.test(clean)) {
    return { tipo: 'audiencia_julgamento', label: 'AUDIÊNCIA DE JULGAMENTO' };
  }

  // 6. CUMPRIMENTO
  if (/CUMPRIMENTO\s+DE\s+SENTEN|EXECU[CÇ][AÃ]O\s+DE\s+SENTEN/.test(clean)) {
    return { tipo: 'cumprimento_sentenca', label: 'CUMPRIMENTO DE SENTENÇA' };
  }

  // 7. CANCELAMENTO
  if (/CANCELAMENTO\s+DA\s+DISTRIBUI|CANCELADA\s+A\s+DISTRIBUI/.test(clean)) {
    return { tipo: 'cancelamento_distribuicao', label: 'CANCELAMENTO DISTRIBUIÇÃO' };
  }

  return { tipo: 'rotina', label: 'INTIMAÇÃO DE ROTINA' };
}

/**
 * Motor de Extração de Keywords Críticas v8.1 — RESUMO SÓ COM PALAVRAS-CHAVE
 * Utilizado para Tarefas e Notificações.
 * Otimizado para ignorar citações de leis e focar no dispositivo.
 */
export function summarizeDjenKeywords(raw: string | null | undefined): string {
  const plain = plainTextFromDjen(raw || "").toUpperCase();
  if (!plain.trim()) return "PUBLICAÇÃO DJEN";

  // Ordem = prioridade de exibição (mais grave primeiro)
  const rules: { re: RegExp; label: string }[] = [
    { re: /INDEFIRO\s+A\s+TUTELA|LIMINAR\s+INDEFERIDA|N[AÃ]O\s+CONCEDO\s+A\s+TUTELA/, label: "LIMINAR INDEFERIDA" },
    { re: /TUTELA\s+DEFERIDA|LIMINAR\s+CONCEDIDA|CONCEDO\s+A\s+TUTELA/, label: "LIMINAR DEFERIDA" },
    { re: /AUTORIZO\s+O\s+DEP[OÓ]SITO|AUTORIZA-SE\s+O\s+DEP[OÓ]SITO|AUTORIZO\s+A\s+CONSIGNA[ÇC][AÃ]O/, label: "DEPÓSITO AUTORIZADO" },
    { re: /BAIXA\s+DEFINITIVA|PROCESSO\s+BAIXADO|DETERMINADA\s+A\s+BAIXA/, label: "BAIXA DEFINITIVA" },
    { re: /TR[AÂ]NSITO\s+EM\s+JULGADO/, label: "TRÂNSITO EM JULGADO" },
    { re: /MANDADO\s+DE\s+BUSCA|EXPEDI[ÇC][AÃ]O\s+DE\s+MANDADO\s+DE\s+BUSCA/, label: "BUSCA E APREENSÃO" },
    { re: /JULGO\s+IMPROCEDENTE|POSTO\s+ISTO.*IMPROCEDENTE/, label: "SENTENÇA IMPROCEDENTE" },
    { re: /JULGO\s+PROCEDENTE|POSTO\s+ISTO.*PROCEDENTE/, label: "SENTENÇA PROCEDENTE" },
    { re: /CUMPRIMENTO\s+DE\s+SENTEN|EXECU[CÇ][AÃ]O\s+DE\s+SENTEN/, label: "CUMPRIMENTO DE SENTENÇA" },
    { re: /EMENDA\s+[AÀ]\s+INICIAL|EMENDE|EMENDA\s+DA\s+INICIAL/, label: "EMENDA À INICIAL" },
    { re: /INDEFERIMENTO\s+DA\s+PETI[ÇC][AÃ]O|INDEFERIDA\s+A\s+INICIAL/, label: "INICIAL INDEFERIDA" },
    { re: /EXTINT|EXTIN[CÇ][AÃ]O|ART\.?\s*485|ABANDONO\s+DA\s+CAUSA/, label: "EXTINÇÃO" },
    { re: /JUSTI[CÇ]A\s+GRATUITA|AJG|ASSIST[EÊ]NCIA\s+JUDICI[AÁ]RIA/, label: "AJG" },
    { re: /CUSTAS|PREPARO|RECOLHIMENTO|UFESP/, label: "CUSTAS" },
    { re: /CONTESTA[CÇ][AÃ]O/, label: "CONTESTAÇÃO" },
    { re: /AUDI[EÊ]NCIA/, label: "AUDIÊNCIA" },
    { re: /REDISTRIBUI|DISTRIBUI[CÇ][AÃ]O/, label: "DISTRIBUIÇÃO" },
    { re: /RECURSO|APELA[CÇ][AÃ]O|AGRAVO/, label: "RECURSO" },
    { re: /HOMOLOG.*ACORDO|ACORDO/, label: "ACORDO" },
  ];

  const hits: string[] = [];
  
  // Extraímos apenas o trecho final (dispositivo) para análise se o texto for muito longo
  // para evitar capturar leis citadas no início.
  const lowerPlain = plain.toLowerCase();
  const indexDispositivo = Math.max(lowerPlain.lastIndexOf("decido"), lowerPlain.lastIndexOf("posto isto"), lowerPlain.lastIndexOf("julgo"));
  const relevantText = indexDispositivo !== -1 ? plain.substring(indexDispositivo) : plain;

  for (const r of rules) {
    // Verificamos na parte relevante primeiro (dispositivo)
    if (r.re.test(relevantText)) {
      if (!hits.includes(r.label)) hits.push(r.label);
    } else if (r.re.test(plain)) {
      // Fallback para o texto todo se não achou no dispositivo mas o termo é crítico (como BA ou Baixa)
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
    return { success: false, error: "CNJ Inválido", count: 0, items: [] };
  }

  const dataFim = opts?.dataFim || new Date().toISOString().split('T')[0];
  const dataInicio = opts?.dataInicio || new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  const masked = `${digits.substring(0,7)}-${digits.substring(7,9)}.${digits.substring(9,13)}.${digits.substring(13,14)}.${digits.substring(14,16)}.${digits.substring(16,20)}`;
  const cnjOptions = [digits, masked];

  let lastError = "";

  for (const cnj of cnjOptions) {
    try {
      const params = new URLSearchParams({
        numeroProcesso: cnj,
        dataDisponibilizacaoInicio: dataInicio,
        dataDisponibilizacaoFim: dataFim,
        pagina: '1',
        itensPorPagina: '50' 
      });

      if (opts?.siglaTribunal && !/^outros$/i.test(opts.siglaTribunal)) {
        params.append('siglaTribunal', opts.siglaTribunal.toUpperCase());
      }

      const response = await fetch(`https://comunicaapi.pje.jus.br/api/v1/comunicacao?${params.toString()}`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'LexisPredict/7.5'
        },
        signal: AbortSignal.timeout(20000),
        cache: 'no-store'
      });

      if (response.status === 403) return { success: false, isGeoBlocked: true, error: "Acesso Negado (Geo-Block). Use Proxy BR.", count: 0, items: [] };
      if (response.status === 429) return { success: false, isRateLimited: true, error: "Limite excedido na API PJe.", count: 0, items: [] };
      if (!response.ok) { lastError = `HTTP ${response.status}`; continue; }

      const data = await response.json();
      const rawItems = Array.isArray(data.items) ? data.items : [];

      const mappedItems: DjenComunicacao[] = rawItems.map((item: any) => ({
        id: item.id || item.comunicacao_id,
        hash: item.hash,
        data_disponibilizacao: item.data_disponibilizacao || item.datadisponibilizacao || null,
        siglaTribunal: item.siglaTribunal || item.siglatribunal || null,
        tipoComunicacao: item.tipoComunicacao || item.tipocomunicacao || null,
        nomeOrgao: item.nomeOrgao || item.nomeorgao || null,
        texto: plainTextFromDjen(item.texto || ""), 
        numero_processo: item.numeroProcesso || item.numeroprocessocommascara || null,
        meio: item.meio || null,
        link: item.link || null,
        tipoDocumento: item.tipoDocumento || item.tipodocumento || null,
        nomeClasse: item.nomeClasse || item.nomeclasse || null
      }));

      return { success: true, count: data.count || mappedItems.length, items: mappedItems };
    } catch (e: any) {
      lastError = e.message || "Error";
    }
  }

  return { success: false, error: lastError || "Comunicação não localizada.", count: 0, items: [] };
}

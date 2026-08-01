/**
 * @fileOverview Motor de Consulta e Higiene DJEN v4.0 — PROTOCOLO BRASIL (gru1)
 * Consulta a API pública do PJe para localizar comunicações oficiais.
 * Inclui motor de sanitização de HTML e sumarização estratégica.
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
 * Remove scripts, estilos e tags, decodificando entidades HTML.
 */
export function plainTextFromDjen(html: string): string {
  if (!html) return "";
  let s = html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<head[\s\S]*?<\/head>/gi, "")
    .replace(/<\/(p|div|tr|br|li|h[1-6]|section|article)>/gi, "\n")
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
    .replace(/&ccedil;/gi, "ç")
    .replace(/&Ccedil;/gi, "Ç")
    .replace(/&otilde;/gi, "õ")
    .replace(/&Otilde;/gi, "Õ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/\s+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
  return s;
}

/**
 * Motor de Extração de Keywords Críticas v5.0
 * Retorna apenas termos essenciais para visualização em cards e alertas.
 */
export function summarizeDjenKeywords(raw: string | null | undefined): string {
  const plain = plainTextFromDjen(raw || "").toUpperCase();
  if (!plain.trim()) return "PUBLICAÇÃO DJEN";

  // Ordem = prioridade de exibição (mais grave primeiro)
  const rules: { re: RegExp; label: string }[] = [
    { re: /BUSCA\s+E\s+APREEN|APREENSAO\s+DO\s+VE[IÍ]CULO|ALIENA[CÇ][AÃ]O\s+FIDUCI[AÁ]RIA.*APREEN/, label: "BUSCA E APREENSÃO" },
    { re: /BAIXA\s+DEFINITIVA|PROCESSO\s+BAIXADO|DETERMINADA\s+A\s+BAIXA/, label: "BAIXA DEFINITIVA" },
    { re: /TR[AÂ]NSITO\s+EM\s+JULGADO/, label: "TRÂNSITO EM JULGADO" },
    { re: /EXTINT|EXTIN[CÇ][AÃ]O|ART\.?\s*485|ABANDONO\s+DA\s+CAUSA|CANCELAMENTO\s+DA\s+DISTRIBUI/, label: "EXTINÇÃO" },
    { re: /IMPROCEDENTE/, label: "IMPROCEDENTE" },
    { re: /PROCEDENTE(?!\s+EM\s+PARTE)/, label: "PROCEDENTE" },
    { re: /PROCEDENTE\s+EM\s+PARTE|PARCIALMENTE\s+PROCEDENTE/, label: "PROCEDENTE EM PARTE" },
    { re: /SENTEN[CÇ]A/, label: "SENTENÇA" },
    { re: /CUMPRIMENTO\s+DE\s+SENTEN|EXECU[CÇ][AÃ]O\s+DE\s+SENTEN/, label: "CUMPRIMENTO DE SENTENÇA" },
    { re: /EMENDA\s+[AÀ]\s+INICIAL|EMENDE|EMENDA\s+DA\s+INICIAL/, label: "EMENDA À INICIAL" },
    { re: /IN[EÉ]PCIA|INDEFER.*INICIAL|INDEFERIMENTO\s+DA\s+PETI/, label: "INDEFERIMENTO / INÉPCIA" },
    { re: /JUSTI[CÇ]A\s+GRATUITA|AJG|ASSIST[EÊ]NCIA\s+JUDICI[AÁ]RIA/, label: "AJG" },
    { re: /CUSTAS|PREPARO|RECOLHIMENTO|UFESP/, label: "CUSTAS" },
    { re: /INTIMA[CÇ][AÃ]O|INTIME-SE/, label: "INTIMAÇÃO" },
    { re: /DESPACHO|DECIS[AÃ]O/, label: "DESPACHO / DECISÃO" },
    { re: /CONTESTA[CÇ][AÃ]O/, label: "CONTESTAÇÃO" },
    { re: /AUDI[EÊ]NCIA/, label: "AUDIÊNCIA" },
    { re: /REDISTRIBUI|DISTRIBUI[CÇ][AÃ]O/, label: "DISTRIBUIÇÃO" },
    { re: /RECURSO|APELA[CÇ][AÃ]O|AGRAVO/, label: "RECURSO" },
    { re: /HOMOLOG.*ACORDO|ACORDO/, label: "ACORDO" },
  ];

  const hits: string[] = [];
  for (const r of rules) {
    if (r.re.test(plain) && !hits.includes(r.label)) {
      hits.push(r.label);
    }
    if (hits.length >= 4) break; // no máximo 4 keywords para não quebrar o layout
  }

  if (hits.length === 0) {
    // fallback curto para evitar texto longo
    const tipo = plain.slice(0, 40).replace(/\s+/g, " ").trim();
    return tipo ? `DJEN · ${tipo}…` : "PUBLICAÇÃO DJEN";
  }

  return hits.join(" · ");
}

/**
 * Gera um resumo operacional baseado em keywords.
 */
export function summarizeDjenForAlert(plainText: string, type?: string): string {
  return summarizeDjenKeywords(plainText);
}

/**
 * Realiza o fetch na API pública do DJEN com detecção de geo-block e limite de 50 itens.
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
    return { success: false, error: "CNJ Inválido (requer 20 dígitos)", count: 0, items: [] };
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
        itensPorPagina: '50' // TETO REAL DA API
      });

      if (opts?.siglaTribunal && !/^outros$/i.test(opts.siglaTribunal)) {
        params.append('siglaTribunal', opts.siglaTribunal.toUpperCase());
      }
      if (opts?.meio) params.append('meio', opts.meio);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);

      const response = await fetch(`https://comunicaapi.pje.jus.br/api/v1/comunicacao?${params.toString()}`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Accept-Language': 'pt-BR,pt;q=0.9',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
          'Origin': 'https://comunica.pje.jus.br',
          'Referer': 'https://comunica.pje.jus.br/'
        },
        signal: controller.signal,
        cache: 'no-store'
      });

      clearTimeout(timeoutId);

      if (response.status === 403) {
        return { 
          success: false, 
          isGeoBlocked: true, 
          error: "DJEN geo-bloqueou o servidor (403). Região Vercel deve ser gru1 (São Paulo).", 
          count: 0, 
          items: [] 
        };
      }

      if (response.status === 429) {
        return { success: false, isRateLimited: true, error: "Rate limit DJEN (429). Aguarde 1 minuto.", count: 0, items: [] };
      }

      if (!response.ok) {
        lastError = `HTTP ${response.status}`;
        continue;
      }

      const data = await response.json();
      const rawItems = Array.isArray(data.items) ? data.items : [];

      const mappedItems: DjenComunicacao[] = rawItems.map((item: any) => {
        const plainText = plainTextFromDjen(item.texto || "");
        return {
          id: item.id || item.comunicacao_id,
          hash: item.hash,
          data_disponibilizacao: item.data_disponibilizacao || item.datadisponibilizacao || null,
          siglaTribunal: item.siglaTribunal || item.siglatribunal || null,
          tipoComunicacao: item.tipoComunicacao || item.tipocomunicacao || null,
          nomeOrgao: item.nomeOrgao || item.nomeorgao || null,
          texto: plainText, 
          numero_processo: item.numeroProcesso || item.numeroprocessocommascara || null,
          meio: item.meio || null,
          link: item.link || null,
          tipoDocumento: item.tipoDocumento || item.tipodocumento || null,
          nomeClasse: item.nomeClasse || item.nomeclasse || null
        };
      });

      return {
        success: true,
        count: data.count || mappedItems.length,
        items: mappedItems
      };
    } catch (e: any) {
      if (e.name === 'AbortError') return { success: false, error: "Tempo esgotado no DJEN.", count: 0, items: [] };
      lastError = e.message || "Erro de conexão";
    }
  }

  return { success: false, error: lastError || "Nenhuma comunicação localizada.", count: 0, items: [] };
}

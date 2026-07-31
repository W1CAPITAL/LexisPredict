/**
 * @fileOverview Motor de Consulta DJEN v3.2 — PROTOCOLO BRASIL (gru1)
 * Consulta a API pública do PJe para localizar comunicações oficiais.
 * Inclui utilitário de sanitização de HTML para texto puro.
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
    .replace(/&iacute;/gi, "í")
    .replace(/&eacute;/gi, "é")
    .replace(/&aacute;/gi, "á")
    .replace(/&atilde;/gi, "ã")
    .replace(/&ccedil;/gi, "ç")
    .replace(/&otilde;/gi, "õ")
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

  const now = new Date();
  const getBrDate = (d: Date) => {
    const offset = -3; // UTC-3
    const brDate = new Date(d.getTime() + offset * 3600 * 1000);
    return brDate.toISOString().split('T')[0];
  };

  const todayBR = getBrDate(now);
  const oneYearAgo = new Date();
  oneYearAgo.setFullYear(now.getFullYear() - 1);
  const oneYearAgoBR = getBrDate(oneYearAgo);

  const dataFim = opts?.dataFim || todayBR;
  const dataInicio = opts?.dataInicio || oneYearAgoBR;

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
      if (opts?.meio) params.append('meio', opts.meio);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 20000);

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
          error: "Bloqueio regional (403). Use região gru1 (São Paulo).", 
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

      const mappedItems: DjenComunicacao[] = rawItems.map((item: any) => ({
        id: item.id || item.comunicacao_id,
        hash: item.hash,
        data_disponibilizacao: item.data_disponibilizacao || item.datadisponibilizacao || null,
        siglaTribunal: item.siglaTribunal || item.siglatribunal || null,
        tipoComunicacao: item.tipoComunicacao || item.tipocomunicacao || null,
        nomeOrgao: item.nomeOrgao || item.nomeorgao || null,
        texto: item.texto || null,
        numero_processo: item.numeroProcesso || item.numeroprocessocommascara || null,
        meio: item.meio || null,
        link: item.link || null,
        tipoDocumento: item.tipoDocumento || item.tipodocumento || null,
        nomeClasse: item.nomeClasse || item.nomeclasse || null
      }));

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

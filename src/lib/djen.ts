/**
 * @fileOverview Motor de Consulta Diário de Justiça Eletrônico Nacional (DJEN) v1.0
 * Consulta a API pública do PJe para localizar comunicações oficiais (Diário/Edital).
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
  destinatarios?: { nome?: string; polo?: string }[];
  advogados?: { nome?: string; numero_oab?: string; uf_oab?: string }[];
}

export interface DjenFetchResult {
  success: boolean;
  error?: string;
  isRateLimited?: boolean;
  count: number;
  items: DjenComunicacao[];
}

/**
 * Realiza o fetch na API pública do DJEN.
 * Nenhuma autenticação ou certificado é necessário para GET.
 */
export async function fetchDjenComunicacoes(protocolo: string, opts?: { siglaTribunal?: string; meio?: 'D' | 'E' | null }): Promise<DjenFetchResult> {
  // Normalização: A API do DJEN costuma aceitar o CNJ com máscara padrão
  const cnjLimpo = protocolo.replace(/\D/g, '');
  if (cnjLimpo.length !== 20) {
    return { success: false, error: "CNJ Inválido", count: 0, items: [] };
  }

  const cnjMascarado = `${cnjLimpo.substring(0,7)}-${cnjLimpo.substring(7,9)}.${cnjLimpo.substring(9,13)}.${cnjLimpo.substring(13,14)}.${cnjLimpo.substring(14,16)}.${cnjLimpo.substring(16,20)}`;

  const params = new URLSearchParams({
    numeroProcesso: cnjMascarado,
    itensPorPagina: '100',
    pagina: '1'
  });

  if (opts?.siglaTribunal) params.append('siglaTribunal', opts.siglaTribunal);
  if (opts?.meio) params.append('meio', opts.meio);

  const url = `https://comunicaapi.pje.jus.br/api/v1/comunicacao?${params.toString()}`;

  try {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), 25000);

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'LexisPredict-DJEN/1.0'
      },
      signal: controller.signal,
      cache: 'no-store'
    });

    clearTimeout(id);

    if (response.status === 429) {
      return { success: false, isRateLimited: true, error: "Rate limit DJEN atingido. Aguarde.", count: 0, items: [] };
    }

    if (!response.ok) {
      throw new Error(`HTTP_${response.status}`);
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
      nomeClasse: item.nomeClasse || item.nomeclasse || null,
      destinatarios: item.destinatarios || [],
      advogados: item.advogados || []
    }));

    return {
      success: true,
      count: data.count || mappedItems.length,
      items: mappedItems
    };

  } catch (e: any) {
    return { 
      success: false, 
      error: e.name === 'AbortError' ? "Tempo esgotado no DJEN" : "Falha na comunicação DJEN", 
      count: 0, 
      items: [] 
    };
  }
}

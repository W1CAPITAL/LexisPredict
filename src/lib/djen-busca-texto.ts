/**
 * DJEN — busca por nome da parte / teor (fila BA, 1 a 1).
 */
import { plainTextFromDjen, type DjenComunicacao, type DjenFetchResult } from '@/lib/djen';

const DJEN_URL = String(process.env.DJEN_API_BASE || 'https://comunicaapi.pje.jus.br/api/v1/comunicacao').replace(/\/$/, '');

async function djenGet(params: URLSearchParams): Promise<DjenFetchResult> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 25000);

    const response = await fetch(`${DJEN_URL}?${params.toString()}`, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        'Accept-Language': 'pt-BR,pt;q=0.9',
        'User-Agent': 'LexisPredict-DJEN-Scanner/1.0',
      },
      signal: controller.signal,
      cache: 'no-store',
    });
    clearTimeout(timeoutId);

    if (response.status === 403) {
      return {
        success: false,
        isGeoBlocked: true,
        error: 'DJEN geo-bloqueou (403). Vercel em gru1 (São Paulo).',
        count: 0,
        items: [],
      };
    }
    if (response.status === 429) {
      return {
        success: false,
        isRateLimited: true,
        error: 'Rate limit DJEN (429).',
        count: 0,
        items: [],
      };
    }
    if (!response.ok) {
      const body = await response.text().catch(() => '');
      const blocked = /<html|<!doctype|access denied|request rejected|proxy/i.test(body);
      return {
        success: false,
        error: blocked ? `DJEN retornou HTML/bloqueio (HTTP ${response.status})` : `HTTP ${response.status}`,
        count: 0,
        items: [],
      };
    }

    const contentType = response.headers.get('content-type') || '';
    const body = await response.text();
    if (!contentType.toLowerCase().includes('application/json') || /^\s*<!doctype|^\s*<html/i.test(body)) {
      return {
        success: false,
        error: 'DJEN retornou HTML em vez de JSON; consulta não foi considerada válida.',
        count: 0,
        items: [],
      };
    }

    let data: any;
    try {
      data = JSON.parse(body);
    } catch {
      return { success: false, error: 'Resposta JSON inválida do DJEN.', count: 0, items: [] };
    }
    const rawItems = Array.isArray(data.items) ? data.items : [];
    const mappedItems: DjenComunicacao[] = rawItems.map((item: any) => {
      const plainText = plainTextFromDjen(item.texto || '');
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
          item.numeroProcesso ||
          item.numeroprocessocommascara ||
          item.numero_processo ||
          null,
        meio: item.meio || null,
        link: item.link || null,
        tipoDocumento: item.tipoDocumento || item.tipodocumento || null,
        nomeClasse: item.nomeClasse || item.nomeclasse || null,
        destinatarios: (() => {
          const destRaw = item.destinatarios || item.destinatario || item.partes || [];
          const destList = Array.isArray(destRaw) ? destRaw : [destRaw];
          return destList
            .map((d: any) => ({
              nome: String(d?.nome || d?.nomeDestinatario || d?.razaoSocial || '').trim() || undefined,
              polo: String(d?.polo || d?.tipoPolo || d?.tipo || '').trim() || undefined,
            }))
            .filter((d: any) => d.nome);
        })(),
      };
    });

    return {
      success: true,
      count: data.count ?? mappedItems.length,
      items: mappedItems,
    };
  } catch (e: any) {
    if (e?.name === 'AbortError') {
      return { success: false, error: 'Tempo esgotado no DJEN.', count: 0, items: [] };
    }
    return {
      success: false,
      error: e?.message || 'Falha DJEN',
      count: 0,
      items: [],
    };
  }
}

/** Busca por nome da parte (titular) — qualquer período informado */
export async function fetchDjenPorNomeParte(
  nomeParte: string,
  opts?: {
    dataInicio?: string;
    dataFim?: string;
    pagina?: number;
    itensPorPagina?: number;
  }
): Promise<DjenFetchResult> {
  const nome = String(nomeParte || '').trim();
  if (nome.length < 5) {
    return { success: false, error: 'Nome muito curto.', count: 0, items: [] };
  }

  const dataFim = opts?.dataFim || new Date().toISOString().split('T')[0];
  // "qualquer dia": padrão ~5 anos (1 request por cliente na fila)
  const dataInicio =
    opts?.dataInicio ||
    new Date(Date.now() - 5 * 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  const params = new URLSearchParams({
    nomeParte: nome,
    dataDisponibilizacaoInicio: dataInicio,
    dataDisponibilizacaoFim: dataFim,
    pagina: String(opts?.pagina || 1),
    itensPorPagina: String(Math.min(opts?.itensPorPagina || 50, 100)),
  });

  return djenGet(params);
}

/** Busca por teor livre */
export async function fetchDjenPorTexto(
  texto: string,
  opts?: {
    dataInicio?: string;
    dataFim?: string;
    pagina?: number;
    itensPorPagina?: number;
    siglaTribunal?: string;
    nomeParte?: string;
  }
): Promise<DjenFetchResult> {
  const q = String(texto || '').trim();
  if (q.length < 4) {
    return { success: false, error: 'Texto de busca muito curto.', count: 0, items: [] };
  }

  const dataFim = opts?.dataFim || new Date().toISOString().split('T')[0];
  const dataInicio =
    opts?.dataInicio ||
    new Date(Date.now() - 5 * 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  const params = new URLSearchParams({
    texto: q,
    dataDisponibilizacaoInicio: dataInicio,
    dataDisponibilizacaoFim: dataFim,
    pagina: String(opts?.pagina || 1),
    itensPorPagina: String(Math.min(opts?.itensPorPagina || 50, 100)),
  });
  if (opts?.nomeParte?.trim()) params.append('nomeParte', opts.nomeParte.trim());
  if (opts?.siglaTribunal && !/^outros$/i.test(opts.siglaTribunal)) {
    params.append('siglaTribunal', opts.siglaTribunal.toUpperCase());
  }

  return djenGet(params);
}

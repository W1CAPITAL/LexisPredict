/**
 * DJEN busca texto — headers iguais ao 09ebace / djen.ts.
 * Detecta HTML/WAF sem quebrar o caller (isHtmlBlock).
 */
import { plainTextFromDjen, type DjenComunicacao, type DjenFetchResult } from '@/lib/djen';

const DJEN_URL = String(process.env.DJEN_API_BASE || 'https://comunicaapi.pje.jus.br/api/v1/comunicacao').replace(
  /\/$/,
  ''
);

function mapItems(rawItems: any[]): DjenComunicacao[] {
  return (rawItems || []).map((item: any) => {
    const plainText = plainTextFromDjen(item.texto || '');
    const destRaw = item.destinatarios || item.destinatario || item.partes || [];
    const destList = Array.isArray(destRaw) ? destRaw : destRaw ? [destRaw] : [];
    return {
      id: item.id || item.comunicacao_id,
      hash: item.hash,
      data_disponibilizacao: item.data_disponibilizacao || item.datadisponibilizacao || null,
      siglaTribunal: item.siglaTribunal || item.siglatribunal || null,
      tipoComunicacao: item.tipoComunicacao || item.tipocomunicacao || null,
      nomeOrgao: item.nomeOrgao || item.nomeorgao || null,
      texto: plainText,
      numero_processo:
        item.numeroProcesso || item.numeroprocessocommascara || item.numero_processo || null,
      meio: item.meio || null,
      link: item.link || null,
      tipoDocumento: item.tipoDocumento || item.tipodocumento || null,
      nomeClasse: item.nomeClasse || item.nomeclasse || null,
      destinatarios: destList
        .map((d: any) => ({
          nome: String(d?.nome || d?.nomeDestinatario || d?.razaoSocial || '').trim() || undefined,
          polo: String(d?.polo || d?.tipoPolo || d?.tipo || '').trim() || undefined,
        }))
        .filter((d: any) => d.nome),
    } as DjenComunicacao;
  });
}

async function djenGet(params: URLSearchParams): Promise<DjenFetchResult & { isHtmlBlock?: boolean }> {
  try {
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
      return {
        success: false,
        isGeoBlocked: true,
        error: 'DJEN 403 geo-block. Vercel região gru1 (São Paulo).',
        count: 0,
        items: [],
      };
    }
    if (response.status === 429) {
      return { success: false, isRateLimited: true, error: 'DJEN 429', count: 0, items: [] };
    }

    const text = await response.text().catch(() => '');
    const trimmed = text.trim();
    if (!response.ok) {
      return {
        success: false,
        isHtmlBlock: /<html|<!doctype/i.test(text),
        error: `HTTP ${response.status}`,
        count: 0,
        items: [],
      };
    }

    // 09ebace fazia response.json(); se vier HTML, marca e falha limpo
    if (trimmed.startsWith('<') || /<!doctype html/i.test(trimmed)) {
      return {
        success: false,
        isHtmlBlock: true,
        error: 'DJEN HTML/WAF na busca por texto',
        count: 0,
        items: [],
      };
    }

    let data: any;
    try {
      data = JSON.parse(trimmed);
    } catch {
      const m = trimmed.match(/\{[\s\S]*"items"\s*:[\s\S]*\}/);
      if (!m) {
        return {
          success: false,
          isHtmlBlock: true,
          error: 'DJEN não retornou JSON',
          count: 0,
          items: [],
        };
      }
      try {
        data = JSON.parse(m[0]);
      } catch {
        return { success: false, error: 'JSON inválido', count: 0, items: [] };
      }
    }

    const items = mapItems(Array.isArray(data.items) ? data.items : []);
    return { success: true, count: data.count ?? items.length, items };
  } catch (e: any) {
    if (e?.name === 'AbortError') {
      return { success: false, error: 'Timeout DJEN', count: 0, items: [] };
    }
    return { success: false, error: e?.message || 'Falha DJEN', count: 0, items: [] };
  }
}

export async function fetchDjenPorNomeParte(
  nomeParte: string,
  opts?: {
    dataInicio?: string;
    dataFim?: string;
    pagina?: number;
    itensPorPagina?: number;
    siglaTribunal?: string;
    texto?: string;
  }
): Promise<DjenFetchResult> {
  const nome = String(nomeParte || '').trim();
  if (nome.length < 3) return { success: false, error: 'Nome curto', count: 0, items: [] };
  const dataFim = opts?.dataFim || new Date().toISOString().split('T')[0];
  const dataInicio =
    opts?.dataInicio || new Date(Date.now() - 365 * 86400000).toISOString().split('T')[0];
  const params = new URLSearchParams({
    nomeParte: nome,
    dataDisponibilizacaoInicio: dataInicio,
    dataDisponibilizacaoFim: dataFim,
    pagina: String(opts?.pagina || 1),
    itensPorPagina: String(Math.min(opts?.itensPorPagina || 50, 100)),
  });
  if (opts?.texto?.trim()) params.append('texto', opts.texto.trim());
  if (opts?.siglaTribunal && !/^outros$/i.test(opts.siglaTribunal)) {
    params.append('siglaTribunal', opts.siglaTribunal.toUpperCase());
  }
  return djenGet(params);
}

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
): Promise<DjenFetchResult & { isHtmlBlock?: boolean }> {
  const q = String(texto || '').trim();
  if (q.length < 3) return { success: false, error: 'Texto curto', count: 0, items: [] };

  const dataFim = opts?.dataFim || new Date().toISOString().split('T')[0];
  const dataInicio =
    opts?.dataInicio || new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];

  const variants = [
    q,
    q
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ')
      .trim(),
  ].filter((v, i, a) => v && a.indexOf(v) === i);

  let last: DjenFetchResult & { isHtmlBlock?: boolean } = {
    success: false,
    error: 'sem tentativa',
    count: 0,
    items: [],
  };

  for (const variant of variants) {
    // tentativa COM tribunal
    const params = new URLSearchParams({
      texto: variant,
      dataDisponibilizacaoInicio: dataInicio,
      dataDisponibilizacaoFim: dataFim,
      pagina: String(opts?.pagina || 1),
      itensPorPagina: String(Math.min(opts?.itensPorPagina || 50, 100)),
    });
    if (opts?.nomeParte?.trim()) params.append('nomeParte', opts.nomeParte.trim());
    if (opts?.siglaTribunal && !/^outros$/i.test(opts.siglaTribunal)) {
      params.append('siglaTribunal', opts.siglaTribunal.toUpperCase());
    }
    last = await djenGet(params);
    if (last.success || last.isRateLimited || last.isGeoBlocked) return last;

    // tentativa SEM siglaTribunal (às vezes o WAF libera)
    if (opts?.siglaTribunal) {
      const p2 = new URLSearchParams({
        texto: variant,
        dataDisponibilizacaoInicio: dataInicio,
        dataDisponibilizacaoFim: dataFim,
        pagina: String(opts?.pagina || 1),
        itensPorPagina: String(Math.min(opts?.itensPorPagina || 50, 100)),
      });
      last = await djenGet(p2);
      if (last.success || last.isRateLimited || last.isGeoBlocked) return last;
    }
  }
  return last;
}

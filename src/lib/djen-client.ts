/**
 * DJEN CLIENTE — consulta direta browser → Comunica PJe (API oficial).
 *
 * Por que client-side: a API responde `Access-Control-Allow-Origin: *`,
 * então o navegador do usuário consulta o DJEN com o IP DELE (residencial),
 * não com o IP do servidor Vercel — que é o IP que o WAF do DJEN bloqueia
 * quando várias rotas do app consultam em rajada.
 *
 * É exatamente como o site comunica.pje.jus.br funciona (o mesmo que o
 * usuário abre no navegador e encontra tudo).
 *
 * Regras desta versão:
 * - Consulta POR TEXTO (ex.: "sem resolução do mérito", "PROCEDIMENTO COMUM CÍVEL")
 *   + intervalo de datas + tribunal. Sem carteira, sem nome, sem CNJ.
 * - Número do processo = SEMPRE o campo oficial `numeroProcesso` da API.
 *   Se vier vazio, o item é descartado (nunca extrai CNJ do teor).
 * - Ritmo: 1 request por vez, ~1,2s entre requests. 429/WAF → espera longa.
 */

export interface DjenItemRaw {
  id?: number | string;
  hash?: string;
  data_disponibilizacao?: string | null;
  siglaTribunal?: string | null;
  tipoComunicacao?: string | null;
  nomeOrgao?: string | null;
  texto?: string | null;
  numeroProcesso?: string | null;
  numero_processo?: string | null;
  nomeClasse?: string | null;
  link?: string | null;
  destinatarios?: Array<{
    nome?: string;
    nomeDestinatario?: string;
    polo?: string;
    tipoPolo?: string;
  }>;
}

export interface DjenClientResult {
  ok: boolean;
  status?: number;
  rateLimited?: boolean;
  htmlBlocked?: boolean;
  geoBlocked?: boolean;
  error?: string;
  items: DjenItemRaw[];
  count?: number;
}

const DJEN_URL = "https://comunicaapi.pje.jus.br/api/v1/comunicacao";

function plainText(html: string): string {
  return String(html || "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, " ")
    .trim();
}

export async function djenBuscaTexto(opts: {
  texto: string;
  dataInicio: string;
  dataFim: string;
  pagina?: number;
  itensPorPagina?: number;
  siglaTribunal?: string;
}): Promise<DjenClientResult> {
  const params = new URLSearchParams({
    texto: opts.texto,
    dataDisponibilizacaoInicio: opts.dataInicio,
    dataDisponibilizacaoFim: opts.dataFim,
    pagina: String(Math.max(1, opts.pagina || 1)),
    itensPorPagina: String(Math.min(opts.itensPorPagina || 50, 100)),
  });
  if (opts.siglaTribunal && !/^outros$/i.test(opts.siglaTribunal)) {
    params.append("siglaTribunal", opts.siglaTribunal.toUpperCase());
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 28000);
  try {
    const res = await fetch(`${DJEN_URL}?${params.toString()}`, {
      method: "GET",
      headers: { Accept: "application/json" },
      signal: controller.signal,
      cache: "no-store",
    });
    if (res.status === 403) {
      return { ok: false, status: 403, geoBlocked: true, error: "DJEN 403", items: [] };
    }
    if (res.status === 429) {
      return { ok: false, status: 429, rateLimited: true, error: "DJEN 429", items: [] };
    }
    const text = await res.text();
    const trimmed = text.trim();
    if (!res.ok || trimmed.startsWith("<") || /<!doctype html/i.test(trimmed)) {
      return {
        ok: false,
        status: res.status,
        htmlBlocked: true,
        error: `HTTP ${res.status} + HTML (WAF)`,
        items: [],
      };
    }
    let data: any;
    try {
      data = JSON.parse(trimmed);
    } catch {
      return { ok: false, status: res.status, error: "Resposta não é JSON", items: [] };
    }
    const rawItems: DjenItemRaw[] = Array.isArray(data.items) ? data.items : [];
    // Normaliza texto (HTML → plain) mantendo o restante intacto.
    for (const it of rawItems) {
      (it as any).texto = plainText(String(it.texto || ""));
    }
    return { ok: true, items: rawItems, count: data.count ?? rawItems.length };
  } catch (e: any) {
    if (e?.name === "AbortError") {
      return { ok: false, error: "Timeout DJEN (28s)", items: [] };
    }
    return { ok: false, error: e?.message || "Falha de rede no DJEN", items: [] };
  } finally {
    clearTimeout(timeout);
  }
}

/** Número oficial: só aceita 20 dígitos do campo numeroProcesso da API. */
export function cnjOficial(item: DjenItemRaw): string | null {
  const d = String(item.numeroProcesso || item.numero_processo || "").replace(/\D/g, "");
  return d.length === 20 ? d : null;
}

export function djenLink(item: DjenItemRaw, digits: string): string {
  const direct = String(item.link || "").trim();
  if (direct.startsWith("http")) return direct;
  const hash = String(item.hash || "").trim();
  if (hash) return `https://comunica.pje.jus.br/consulta?hash=${encodeURIComponent(hash)}`;
  if (item.id != null)
    return `https://comunica.pje.jus.br/consulta?id=${encodeURIComponent(String(item.id))}`;
  const masked = `${digits.slice(0, 7)}-${digits.slice(7, 9)}.${digits.slice(9, 13)}.${digits.slice(13, 14)}.${digits.slice(14, 16)}.${digits.slice(16, 20)}`;
  return `https://comunica.pje.jus.br/#/consulta?numeroProcesso=${encodeURIComponent(masked)}`;
}

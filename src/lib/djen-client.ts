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
 * Divisão desta versão:
 * - djenBuscaTexto(texto, intervaloDatas, tribunal) → feed por texto.
 * - djenBuscaNomeParte(nome, criterioBA?, intervaloDatas, tribunal) →
 *   consulta por motivo + nome + filtro de materia (ex.: busca e apreensão)
 *   com paginação e exaustivo.
 *
 * Regras:
 * - Número do processo = SEMPRE o campo oficial `numeroProcesso` da API.
 *   Se vier vazio, o item é descartado (nunca extrai CNJ do teor).
 * - Ritmo: 1 request por vez, ~1,2s entre requests. 429/WAF → espera longa.
 * - Nomes extraídos pelo autor/requerente no teor; telefone feito por match
 *   exato de texto com o campo do teor (não por coerção).
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
  retryAfter?: string | null;
}

const DJEN_URL = "https://comunicaapi.pje.jus.br/api/v1/comunicacao";

export function plainText(html: string): string {
  return String(html || "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(?:p|div|li|tr)>/gi, "\n")
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

export async function djenBuscaTexto(
  opts: {
    texto: string;
    signal?: AbortSignal;
    dataInicio: string;
    dataFim: string;
    pagina?: number;
    itensPorPagina?: number;
    siglaTribunal?: string;
  }
): Promise<DjenClientResult> {
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
  const cancel = () => controller.abort();
  if (opts.signal?.aborted) controller.abort();
  opts.signal?.addEventListener('abort', cancel, { once: true });
  const timeout = setTimeout(() => controller.abort(), 28000);
  try {
    const res = await fetch(`${DJEN_URL}?${params.toString()}`, {
      method: "GET",
      headers: { Accept: "application/json" },
      signal: controller.signal,
      cache: "no-store",
    });
    if (res.status === 403) {
      return { ok: false, status: 403, htmlBlocked: true, error: "DJEN recusou a consulta (403). Tente mais tarde.", items: [] };
    }
    if (res.status === 429) {
      return { ok: false, status: 429, rateLimited: true, retryAfter: res.headers.get("Retry-After"), error: "DJEN 429", items: [] };
    }
    const text = await res.text();
    const trimmed = text.trim();
    if (!trimmed) {
      return {
        ok: false,
        status: res.status,
        error: `DJEN respondeu vazio (HTTP ${res.status}). Tente outro intervalo de datas ou tribunal.`,
        items: [],
      };
    }
    if (!res.ok || trimmed.startsWith("<") || /<!doctype html/i.test(trimmed)) {
      return {
        ok: false,
        status: res.status,
        htmlBlocked: trimmed.startsWith("<") || /<!doctype html/i.test(trimmed),
        error: trimmed.startsWith("<") || /<!doctype html/i.test(trimmed)
          ? `DJEN respondeu HTML/WAF (HTTP ${res.status}). Bloqueio de rede — tente outro horário ou rede.`
          : `DJEN indisponível (HTTP ${res.status}): ${trimmed.slice(0, 120)}`,
        items: [],
      };
    }
    let data: any;
    try {
      data = JSON.parse(trimmed);
    } catch {
      return {
        ok: false,
        status: res.status,
        error: `Resposta não é JSON (HTTP ${res.status}): ${trimmed.slice(0, 100)}`,
        items: [],
      };
    }
    // API às vezes devolve items em status/mensagem sem array
    if (data == null || (!Array.isArray(data) && !Array.isArray(data.items) && !Array.isArray(data.content))) {
      return { ok: false, status: res.status, error: "DJEN retornou JSON sem uma lista de publicações. Tente novamente mais tarde.", items: [] };
    }
    const rawItems: DjenItemRaw[] = Array.isArray(data.items)
      ? data.items
      : Array.isArray(data.content)
        ? data.content
        : Array.isArray(data)
          ? data
          : [];
    const items = rawItems.filter(it => it && typeof it === "object").map(it => ({ ...it, texto: plainText(String(it.texto || "")) }));
    return { ok: true, items, count: data.count ?? items.length };
  } catch (e: any) {
    if (e?.name === "AbortError") {
      return { ok: false, error: opts.signal?.aborted ? "Consulta interrompida." : "Timeout DJEN (28s)", items: [] };
    }
    return { ok: false, error: e?.message || "Falha de rede no DJEN", items: [] };
  } finally {
    clearTimeout(timeout);
    opts.signal?.removeEventListener('abort', cancel);
  }
}

/**
 * Extração de nome do autor/requerente no teor; devolve `` se não achar.
 */
export function extractNomeDoAutor(texto: string | null | undefined): string {
  const t = String(texto || "");
  const match = t.match(/\b(?:AUTOR(?:A)?|REQUERENTE|EXEQUENTE)\s*[:\-–]\s*([^\n;]{3,150}?)(?=\s+(?:ADVOGAD[OA]|OAB|R[EÉ]U|REQUERIDO|CPF|CNPJ|TELEFONE|TEL|EMAIL|E-MAIL|DECIS[AÃ]O|VISTOS)\b|\n|;|$)/i);
  return match?.[1]?.trim().replace(/[,\s]+$/, "").slice(0, 120) || "";
}

export function extractEmailFromDjenText(texto: string | null | undefined): string {
  return String(texto || "").match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] || "";
}

/** Exige indicação de contato ou nome próximo; ignora números documentais. */
export function extractTelefonePorContexto(texto: string | null | undefined, nomeAutor?: string): string {
  const t = String(texto || "");
  const re = /(?<![\d.])(?:\+?55[ -]*)?\(?([1-9]\d)\)?[ -]*(9\d{4}|[2-5]\d{3})[ -]?(\d{4})(?![\d.-])/g;
  for (const match of t.matchAll(re)) {
    const index = match.index!;
    const before = t.slice(Math.max(0, index - 90), index);
    if (/\b(?:CPF|CNPJ|RENAVAM|OAB|PROCESSO|PROTOCOLO|CHASSI)\s*(?:n[.º°o]*\s*)?[:\-]?\s*$/i.test(before)) continue;
    const labeled = /(?:telefone|tel\.?|celular|whats(?:app)?|contato)\s*[:\-]?\s*$/i.test(before);
    const clause = before.split(/[;\n]/).at(-1) || "";
    if (/advogad[oa]|escrit[oó]rio|oab|cart[oó]rio|secretaria/i.test(clause)) continue;
    const nearName = !!nomeAutor && clause.toLocaleLowerCase().includes(nomeAutor.toLocaleLowerCase());
    if (labeled || nearName) return formatTelefone(match[1] + match[2] + match[3]);
  }
  return "";
}

/** A janela é a data oficial da publicação, nunca uma data extraída do teor. */
export function dataPublicacaoNaJanela(data: unknown, inicio: string, fim: string): boolean {
  const raw = String(data || "");
  const br = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  const iso = br ? `${br[3]}-${br[2]}-${br[1]}` : raw.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false;
  const time = Date.parse(`${iso}T00:00:00Z`);
  return Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === iso && iso >= inicio && iso <= fim;
}

function formatTelefone(digits: string): string {
  const d = digits.replace(/\D/g, "");
  if (d.length === 11) {
    return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  }
  if (d.length === 10) {
    return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  }
  return "";
}

export function cnjOficial(item: DjenItemRaw): string | null {
  const d = String(item.numeroProcesso || item.numero_processo || "").replace(/\D/g, "");
  return d.length === 20 ? d : null;
}

export function djenLink(item: DjenItemRaw, digits: string): string {
  const direct = String(item.link || "").trim();
  if (direct.startsWith("http")) return direct;
  const hash = String(item.hash || "").trim();
  if (hash) return `https://comunica.pje.jus.br/consulta?hash=${encodeURIComponent(hash)}`;
  if (item.id != null) return `https://comunica.pje.jus.br/consulta?id=${encodeURIComponent(String(item.id))}`;
  const masked = `${digits.slice(0, 7)}-${digits.slice(7, 9)}.${digits.slice(9, 13)}.${digits.slice(13, 14)}.${digits.slice(14, 16)}.${digits.slice(16, 20)}`;
  return `https://comunica.pje.jus.br/#/consulta?numeroProcesso=${encodeURIComponent(masked)}`;
}

/**
 * Consulta DJEN por nome da parte + critério BA + intervalo + tribunal.
 * Exemplo: "busca e apreensão ANDERSON" + filtro de materia (BA)
 * com paginação até exaustivo ou alvo.
 */
export async function djenBuscaNomeParte(
  opts: {
    nome: string;
    texto?: string;
    criterioBuscaApreensao?: boolean;
    dataInicio: string;
    dataFim: string;
    pagina?: number;
    itensPorPagina?: number;
    siglaTribunal?: string;
  }
): Promise<DjenClientResult> {
  const nome = String(opts.nome || "").trim();
  if (nome.length < 3) {
    return { ok: false, error: "Nome curto", items: [] };
  }

  const params = new URLSearchParams({
    nomeParte: nome,
    dataDisponibilizacaoInicio: opts.dataInicio,
    dataDisponibilizacaoFim: opts.dataFim,
    pagina: String(Math.max(1, opts.pagina || 1)),
    itensPorPagina: String(Math.min(opts.itensPorPagina || 50, 100)),
  });

  if (opts.criterioBuscaApreensao) {
    const qBA = "busca e apreensão";
    params.set("texto", qBA);
    if (nome) params.set("nomeParte", nome);
  } else if (opts.texto && opts.texto.trim()) {
    params.set("texto", opts.texto.trim());
  }

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
    if (!trimmed) return { ok: false, status: res.status, error: `DJEN respondeu vazio (HTTP ${res.status}). Tente novamente mais tarde.`, items: [] };
    if (!res.ok || trimmed.startsWith("<") || /<!doctype html/i.test(trimmed)) {
      return {
        ok: false,
        status: res.status,
        htmlBlocked: trimmed.startsWith("<"),
        error: trimmed.startsWith("<") ? `DJEN respondeu HTML/WAF (HTTP ${res.status}). Tente mais tarde.` : `DJEN indisponível (HTTP ${res.status}).`,
        items: [],
      };
    }
    let data: any;
    try {
      data = JSON.parse(trimmed);
    } catch {
      return { ok: false, status: res.status, error: "Resposta não é JSON", items: [] };
    }
    if (data == null || (!Array.isArray(data) && !Array.isArray(data.items) && !Array.isArray(data.content))) {
      return { ok: false, status: res.status, error: "DJEN retornou JSON sem uma lista de publicações. Tente novamente mais tarde.", items: [] };
    }
    const rawItems: DjenItemRaw[] = Array.isArray(data.items) ? data.items : Array.isArray(data.content) ? data.content : Array.isArray(data) ? data : [];
    const items = rawItems.filter(it => it && typeof it === "object").map(it => ({ ...it, texto: plainText(String(it.texto || "")) }));
    return { ok: true, items, count: data.count ?? items.length };
  } catch (e: any) {
    if (e?.name === "AbortError") {
      return { ok: false, error: "Timeout DJEN (28s)", items: [] };
    }
    return { ok: false, error: e?.message || "Falha de rede no DJEN", items: [] };
  } finally {
    clearTimeout(timeout);
  }
}

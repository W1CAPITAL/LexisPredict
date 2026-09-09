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

export async function djenBuscaTexto(
  opts: {
    texto: string;
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

/**
 * Extração de nome do autor/requerente no teor; devolve `` se não achar.
 */
export function extractNomeDoAutor(texto: string | null | undefined): string {
  const t = String(texto || "");
  if (!t) return "";
  const re = /(?:AUTOR|REQUERENTE|EXEQUENTE)\s*[:\-–]\s*([A-ZÁÉÍÓÚÂÊÔÃÕÇ][A-ZÁÉÍÓÚÂÊÔÃÕÇa-záéíóúâêôãõç\s\.'\-]{6,80}?)(?:\s{2,}|\s+ADVOGADO|\s+R[EÉ]U|$) /i;
  const m = t.match(re);
  if (m?.[1]) {
    const n = m[1].trim().slice(0, 80);
    if (n.length >= 6) return n;
  }
  return "";
}

/**
 * Extração de telefone do próprio teor.
 * Só confia quando o número aparece junto do nome do autor/requerente
 * ou numa linha que menciona intimar/citir/citar a parte pelo nome —
 * para evitar pegar telefone de terceiros citados no mesmo teor.
 */
export function extractTelefonePorContexto(
  texto: string | null | undefined,
  nomeAutor?: string
): string {
  const t = String(texto || "");
  if (!t || t.length < 20) return "";

  const cleaned = t.replace(/\b\d{7}-\d{2}\.\d{4}\.\d.\d{2}.\d{4}\b/g, " ");
  const re = /(?:\+?55\s*)?(?:\(?(\d{2,3})\)?\s*)?(?:\(?(\d{4,5})\)?[-\s]?)(\d{4})/g;
  const candidatos: Array<{ digits: string; idx: number }> = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(cleaned))) {
    const ddd = m[1] ? m[1].replace(/\D/g, "") : "";
    const p1 = m[2] ? m[2].replace(/\D/g, "") : "";
    const p2 = m[3] ? m[3].replace(/\D/g, "") : "";
    const digits = (ddd + p1 + p2).replace(/\D/g, "").slice(0, 11);
    if (digits.length >= 9) {
      candidatos.push({ digits, idx: m.index });
    }
  }
  if (candidatos.length === 0) return "";

  if (nomeAutor) {
    const nomeLower = nomeAutor.toLowerCase();
    const best = candidatos.slice().sort((a, b) => a.idx - b.idx)[0];
    if (best) {
      const sliceAround = t.slice(Math.max(0, best.idx - 400), best.idx + 400).toLowerCase();
      if (sliceAround.includes(nomeLower) || sliceAround.includes(nomeLower.replace(/\s+/g, ""))) {
        return formatTelefone(best.digits);
      }
    }
  }

  const first = candidatos[0];
  if (first) {
    const sliceAround = t.slice(Math.max(0, first.idx - 400), first.idx + 400);
    const lower = sliceAround.toLowerCase();
    if (!/(advogado|escritório|oab)/i.test(lower)) {
      return formatTelefone(first.digits);
    }
  }
  return "";
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

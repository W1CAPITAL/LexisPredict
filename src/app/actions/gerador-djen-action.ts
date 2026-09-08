"use server";

import { fetchDjenPorTexto } from "@/lib/djen-busca-texto";
import {
  FILTROS_REVISIONAL,
  cnjDvValido,
  extractCnjFromApiField,
  extractCnjFromTextoStrict,
  extractNomeCompletoFromDjen,
  extractTelefoneFromText,
  formatCnjMasked,
  isSegredoOuSigilo,
  matchFiltrosRevisional,
  teorConsultavel,
  type FiltroRevisionalId,
  type ProcessoDjenReal,
  type ScanLogLine,
} from "@/lib/revisional-tribunal-filtros";

function ymdDaysAgo(days: number): string {
  return new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
}
function hojeYmd(): string {
  return new Date().toISOString().slice(0, 10);
}
function log(level: ScanLogLine["level"], text: string): ScanLogLine {
  return { ts: new Date().toISOString().slice(11, 19), level, text };
}

function buildLink(it: any, digits: string): string {
  const direct = String(it?.link || "").trim();
  if (direct.startsWith("http")) return direct;
  const hash = String(it?.hash || "").trim();
  if (hash) return `https://comunica.pje.jus.br/consulta?hash=${encodeURIComponent(hash)}`;
  if (it?.id != null) return `https://comunica.pje.jus.br/consulta?id=${encodeURIComponent(String(it.id))}`;
  return `https://comunica.pje.jus.br/#/consulta?numeroProcesso=${encodeURIComponent(formatCnjMasked(digits))}`;
}

/**
 * Uma página de scan. O client chama em loop até atingir `alvo`.
 * Nunca inventa CNJ/nome/telefone. Telefone só se estiver no teor público.
 */
export async function scanDjenPaginaAction(input: {
  filtros: FiltroRevisionalId[];
  /** índice da query (0..filtros-1) */
  queryIndex: number;
  pagina: number;
  dias?: number;
  siglaTribunal?: string;
  /** CNJs já aceitos (não repetir) */
  excludeCnjs?: string[];
}): Promise<{
  success: boolean;
  items: ProcessoDjenReal[];
  logs: ScanLogLine[];
  query: string;
  queryIndex: number;
  pagina: number;
  hasMore: boolean;
  rateLimited?: boolean;
  geoBlocked?: boolean;
  error?: string;
}> {
  const logs: ScanLogLine[] = [];
  const ativos = (input.filtros || []).filter(Boolean) as FiltroRevisionalId[];
  if (!ativos.length) {
    return { success: false, items: [], logs: [log("err", "Nenhum filtro marcado.")], query: "", queryIndex: 0, pagina: 1, hasMore: false, error: "filtros" };
  }

  const defs = FILTROS_REVISIONAL.filter((f) => ativos.includes(f.id));
  const qi = Math.max(0, Math.min(input.queryIndex || 0, defs.length - 1));
  const pagina = Math.max(1, input.pagina || 1);
  const q = defs[qi]?.djenQuery || "";
  const dias = Math.min(Math.max(Number(input.dias) || 7, 1), 45);
  const dataFim = hojeYmd();
  const dataInicio = ymdDaysAgo(dias);
  const sigla = input.siglaTribunal?.trim().toUpperCase() || undefined;
  const exclude = new Set((input.excludeCnjs || []).map((c) => c.replace(/\D/g, "")));

  logs.push(log("info", `Query ${qi + 1}/${defs.length}: “${q}” · página ${pagina} · ${dataInicio}→${dataFim}${sigla ? ` · ${sigla}` : ""}`));

  const res = await fetchDjenPorTexto(q, {
    dataInicio,
    dataFim,
    pagina,
    itensPorPagina: 100,
    siglaTribunal: sigla,
  });

  if (res.isGeoBlocked) {
    logs.push(log("err", "DJEN geo-bloqueou (403). Deploy em São Paulo (gru1)."));
    return { success: false, items: [], logs, query: q, queryIndex: qi, pagina, hasMore: false, geoBlocked: true, error: res.error };
  }
  if (res.isRateLimited) {
    logs.push(log("warn", "Rate limit 429 — aguarde e continue o scan."));
    return { success: false, items: [], logs, query: q, queryIndex: qi, pagina, hasMore: true, rateLimited: true, error: res.error };
  }
  if (!res.success) {
    logs.push(log("err", res.error || "Falha DJEN"));
    return { success: false, items: [], logs, query: q, queryIndex: qi, pagina, hasMore: false, error: res.error };
  }

  logs.push(log("info", `API devolveu ${res.items?.length || 0} itens brutos`));

  const items: ProcessoDjenReal[] = [];
  let skipSigilo = 0, skipCnj = 0, skipNome = 0, skipTeor = 0, skipDup = 0;

  for (const it of res.items || []) {
    const blob = `${it.nomeClasse || ""} ${it.texto || ""} ${it.tipoComunicacao || ""}`;
    if (isSegredoOuSigilo(blob)) {
      skipSigilo++;
      continue;
    }
    const digits =
      extractCnjFromApiField(it.numero_processo) ||
      extractCnjFromTextoStrict(String(it.texto || ""));
    if (!digits || !cnjDvValido(digits)) {
      skipCnj++;
      continue;
    }
    if (exclude.has(digits)) {
      skipDup++;
      continue;
    }
    if (!teorConsultavel(it.texto)) {
      skipTeor++;
      continue;
    }
    const nome = extractNomeCompletoFromDjen({
      texto: it.texto,
      destinatarios: (it as any).destinatarios,
    });
    if (!nome) {
      skipNome++;
      continue;
    }

    const { hits } = matchFiltrosRevisional(blob, ativos);
    // sinal mínimo de matéria bancária/revisional quando filtros padrão
    const n = blob.toLowerCase();
    const sinal =
      hits.length > 0 ||
      /revisional|fiduci|banc[aá]ri|financiamento|contrato|procedimento\s+comum/.test(n);
    if (!sinal) continue;

    const tel = extractTelefoneFromText(it.texto);
    items.push({
      processo: formatCnjMasked(digits),
      nome_completo: nome,
      telefone: tel,
      telefone_fonte: tel ? "teor_djen_publico" : "",
      classe: String(it.nomeClasse || "").trim(),
      assunto_ou_teor: String(it.texto || "").replace(/\s+/g, " ").trim().slice(0, 220),
      situacao_hint:
        hits.map((id) => FILTROS_REVISIONAL.find((f) => f.id === id)?.nomeTribunal).filter(Boolean).join(" · ") ||
        String(it.tipoComunicacao || ""),
      tribunal: String(it.siglaTribunal || "").toUpperCase(),
      data: String(it.data_disponibilizacao || "").slice(0, 10),
      link: buildLink(it, digits),
      filtros: hits.join("|"),
      consultavel: true,
    });
  }

  logs.push(
    log(
      "ok",
      `Aceitos nesta página: ${items.length} · descartados sigilo:${skipSigilo} cnj:${skipCnj} sem nome:${skipNome} teor curto:${skipTeor} duplicados:${skipDup}`
    )
  );

  const hasMore = (res.items?.length || 0) >= 50;
  return {
    success: true,
    items,
    logs,
    query: q,
    queryIndex: qi,
    pagina,
    hasMore,
  };
}

/** Lista de queries para o client saber quantas voltas dar */
export async function listarQueriesDjenAction(filtros: FiltroRevisionalId[]) {
  return FILTROS_REVISIONAL.filter((f) => filtros.includes(f.id)).map((f) => ({
    id: f.id,
    query: f.djenQuery,
    nome: f.nomeTribunal,
  }));
}

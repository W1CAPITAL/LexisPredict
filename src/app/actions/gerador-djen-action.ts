"use server";

import { fetchDjenPorTexto } from "@/lib/djen-busca-texto";
import {
  FILTROS_REVISIONAL,
  cnjDvValido,
  extractCnjRobusto,
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

export async function scanDjenPaginaAction(input: {
  filtros: FiltroRevisionalId[];
  queryIndex: number;
  pagina: number;
  /** janela em dias (client pode aumentar sozinho) */
  dias: number;
  siglaTribunal?: string;
  excludeCnjs?: string[];
}): Promise<{
  success: boolean;
  items: ProcessoDjenReal[];
  logs: ScanLogLine[];
  query: string;
  queryIndex: number;
  pagina: number;
  /** ainda vale pedir a próxima página desta query */
  hasMore: boolean;
  /** itens brutos da API (para o client não desistir cedo) */
  bruto: number;
  rateLimited?: boolean;
  geoBlocked?: boolean;
  error?: string;
}> {
  const logs: ScanLogLine[] = [];
  const ativos = (input.filtros || []).filter(Boolean) as FiltroRevisionalId[];
  if (!ativos.length) {
    return { success: false, items: [], logs: [log("err", "Nenhum filtro.")], query: "", queryIndex: 0, pagina: 1, hasMore: false, bruto: 0, error: "filtros" };
  }

  const defs = FILTROS_REVISIONAL.filter((f) => ativos.includes(f.id));
  const qi = Math.max(0, Math.min(input.queryIndex || 0, defs.length - 1));
  const pagina = Math.max(1, input.pagina || 1);
  const q = defs[qi]?.djenQuery || "";
  const dias = Math.min(Math.max(Number(input.dias) || 7, 1), 90);
  const dataFim = new Date().toISOString().slice(0, 10);
  const dataInicio = new Date(Date.now() - dias * 86400000).toISOString().slice(0, 10);
  const sigla = input.siglaTribunal?.trim().toUpperCase() || undefined;
  const exclude = new Set((input.excludeCnjs || []).map((c) => c.replace(/\D/g, "")));

  logs.push(log("info", `Filtro ${qi + 1}/${defs.length} “${q}” · pág ${pagina} · ${dias}d (${dataInicio}→${dataFim})${sigla ? ` · ${sigla}` : ""}`));

  const res = await fetchDjenPorTexto(q, {
    dataInicio,
    dataFim,
    pagina,
    itensPorPagina: 100,
    siglaTribunal: sigla,
  });

  if ((res as any).isGeoBlocked) {
    logs.push(log("err", "DJEN 403 geo-block. Use região São Paulo (gru1)."));
    return { success: false, items: [], logs, query: q, queryIndex: qi, pagina, hasMore: false, bruto: 0, geoBlocked: true, error: res.error };
  }
  if (res.isRateLimited) {
    logs.push(log("warn", "429 rate limit — client deve esperar e repetir a mesma página."));
    return { success: false, items: [], logs, query: q, queryIndex: qi, pagina, hasMore: true, bruto: 0, rateLimited: true, error: res.error };
  }
  if (!res.success) {
    logs.push(log("err", res.error || "Falha DJEN"));
    return { success: false, items: [], logs, query: q, queryIndex: qi, pagina, hasMore: false, bruto: 0, error: res.error };
  }

  const bruto = res.items?.length || 0;
  logs.push(log("info", `API: ${bruto} itens brutos`));

  const items: ProcessoDjenReal[] = [];
  let skipSigilo = 0, skipCnj = 0, skipNome = 0, skipTeor = 0, skipDup = 0;

  for (const it of res.items || []) {
    const blob = `${it.nomeClasse || ""} ${it.texto || ""} ${it.tipoComunicacao || ""}`;
    if (isSegredoOuSigilo(blob)) {
      skipSigilo++;
      continue;
    }
    const digits = extractCnjRobusto(it.numero_processo, it.texto);
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
    const n = blob.toLowerCase();
    const sinal =
      hits.length > 0 ||
      /revisional|fiduci|banc[aá]ri|financiamento|contrato|ind[eé]bito|procedimento\s+comum/.test(n);
    if (!sinal) continue;

    const tel = extractTelefoneFromText(it.texto);
    items.push({
      processo: formatCnjMasked(digits),
      nome_completo: nome,
      telefone: tel,
      telefone_fonte: tel ? "teor_djen_publico" : "",
      classe: String(it.nomeClasse || "").trim(),
      assunto_ou_teor: String(it.texto || "").replace(/\s+/g, " ").trim().slice(0, 240),
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
      `Aceitos: ${items.length} · fora sigilo:${skipSigilo} cnj:${skipCnj} nome:${skipNome} teor:${skipTeor} dup:${skipDup}`
    )
  );

  // Continua paginando se a API ainda encheu a página
  const hasMore = bruto >= 80;
  return { success: true, items, logs, query: q, queryIndex: qi, pagina, hasMore, bruto };
}

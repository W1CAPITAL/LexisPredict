"use server";

import { fetchDjenPorTexto } from "@/lib/djen-busca-texto";
import { extractCnjSeguro, extractTelefoneSeguro, formatCnjMasked } from "@/lib/cnj-higiene";
import {
  FILTROS_REVISIONAL,
  extractNomeCompletoFromDjen,
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
  dias: number;
  siglaTribunal?: string;
  excludeCnjs?: string[];
  enrich?: boolean;
}): Promise<{
  success: boolean;
  items: ProcessoDjenReal[];
  logs: ScanLogLine[];
  query: string;
  queryIndex: number;
  pagina: number;
  hasMore: boolean;
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

  logs.push(log("info", `Filtro ${qi + 1}/${defs.length} “${q}” · pág ${pagina} · ${dias}d · CNJ só máscara+estrutura`));

  const res = await fetchDjenPorTexto(q, {
    dataInicio,
    dataFim,
    pagina,
    itensPorPagina: 100,
    siglaTribunal: sigla,
  });

  if ((res as any).isGeoBlocked) {
    return { success: false, items: [], logs: [...logs, log("err", "403 geo")], query: q, queryIndex: qi, pagina, hasMore: false, bruto: 0, geoBlocked: true, error: res.error };
  }
  if (res.isRateLimited) {
    return { success: false, items: [], logs: [...logs, log("warn", "429")], query: q, queryIndex: qi, pagina, hasMore: true, bruto: 0, rateLimited: true, error: res.error };
  }
  if (!res.success) {
    return { success: false, items: [], logs: [...logs, log("err", res.error || "falha")], query: q, queryIndex: qi, pagina, hasMore: false, bruto: 0, error: res.error };
  }

  const bruto = res.items?.length || 0;
  logs.push(log("info", `API: ${bruto} brutos`));

  const items: ProcessoDjenReal[] = [];
  let skipSigilo = 0, skipCnj = 0, skipNome = 0, skipTeor = 0, skipDup = 0, skipSinal = 0;

  for (const it of res.items || []) {
    const blob = `${it.nomeClasse || ""} ${it.texto || ""} ${it.tipoComunicacao || ""}`;
    if (isSegredoOuSigilo(blob)) { skipSigilo++; continue; }

    // CRÍTICO: só CNJ mascarado + ano/TR/justiça plausíveis (ex. TJSP = 8.26)
    const digits = extractCnjSeguro(it.numero_processo, it.texto, {
      siglaTribunal: sigla || it.siglaTribunal,
    });
    if (!digits) { skipCnj++; continue; }
    if (exclude.has(digits)) { skipDup++; continue; }
    if (!teorConsultavel(it.texto)) { skipTeor++; continue; }

    const nome = extractNomeCompletoFromDjen({
      texto: it.texto,
      destinatarios: (it as any).destinatarios,
    });
    if (!nome) { skipNome++; continue; }

    const { hits } = matchFiltrosRevisional(blob, ativos);
    const n = blob.toLowerCase();
    const sinal =
      hits.length > 0 ||
      /revisional|fiduci|banc[aá]ri|financiamento|contrato|ind[eé]bito|procedimento\s+comum/.test(n);
    if (!sinal) { skipSinal++; continue; }

    const telTeor = extractTelefoneSeguro(it.texto);
    items.push({
      processo: formatCnjMasked(digits),
      nome_completo: nome,
      telefone: telTeor,
      email: "",
      cpf: "",
      cnpj: "",
      endereco: "",
      cep: "",
      bairro: "",
      municipio: "",
      uf: "",
      situacao_cadastral: "",
      telefone_fonte: telTeor ? "teor_djen_publico" : "",
      enrich_fonte: "",
      classe: String(it.nomeClasse || "").trim(),
      assunto_ou_teor: String(it.texto || "").replace(/\s+/g, " ").trim().slice(0, 240),
      situacao_hint:
        hits.map((id) => FILTROS_REVISIONAL.find((f) => f.id === id)?.nomeTribunal).filter(Boolean).join(" · ") ||
        String(it.tipoComunicacao || ""),
      tribunal: String(it.siglaTribunal || sigla || "").toUpperCase(),
      data: String(it.data_disponibilizacao || "").slice(0, 10),
      link: buildLink(it, digits),
      filtros: hits.join("|"),
      consultavel: true,
    });
  }

  logs.push(
    log(
      "ok",
      `Aceitos ${items.length} · sigilo:${skipSigilo} cnj_falso/sem_mascara:${skipCnj} nome:${skipNome} teor:${skipTeor} dup:${skipDup} sinal:${skipSinal}`
    )
  );

  return {
    success: true,
    items,
    logs,
    query: q,
    queryIndex: qi,
    pagina,
    hasMore: bruto >= 80,
    bruto,
  };
}

export async function enrichmentConfigAction() {
  const enabled = ["1", "true", "yes", "on"].includes(
    String(process.env.ENRICHMENT_LOOKUP_ENABLED || "").toLowerCase()
  );
  const urlSet = !!String(process.env.ENRICHMENT_LOOKUP_URL || "").trim();
  const tokenSet = !!String(process.env.ENRICHMENT_LOOKUP_TOKEN || "").trim();
  return { enabled, urlSet, tokenSet, ready: enabled && urlSet && tokenSet };
}

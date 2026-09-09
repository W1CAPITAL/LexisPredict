"use server";

import { fetchDjenPorTexto } from "@/lib/djen-busca-texto";
import {
  FILTROS_STATUS,
  FILTROS_MATERIA,
  buildDjenQueries,
  passaFiltrosCombinados,
  textoTemCnpj,
  extractCnjSeguro,
  extractTelefoneSeguro,
  extractNomeCompletoFromDjen,
  formatCnjMasked,
  isSegredoOuSigilo,
  teorConsultavel,
  type FiltroStatusId,
  type FiltroMateriaId,
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

export async function enrichmentConfigAction() {
  const enabled = ["1", "true", "yes", "on"].includes(
    String(process.env.ENRICHMENT_LOOKUP_ENABLED || "").toLowerCase()
  );
  const urlSet = !!String(process.env.ENRICHMENT_LOOKUP_URL || "").trim();
  const tokenSet = !!String(process.env.ENRICHMENT_LOOKUP_TOKEN || "").trim();
  return { enabled, urlSet, tokenSet, ready: enabled && urlSet && tokenSet };
}

export async function scanDjenPaginaAction(input: {
  statusFiltros: FiltroStatusId[];
  materiaFiltros: FiltroMateriaId[];
  queryIndex: number;
  pagina: number;
  dataInicio?: string;
  dataFim?: string;
  dias?: number;
  siglaTribunal?: string;
  excludeCnjs?: string[];
  cnpj?: string;
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
  totalQueries: number;
  rateLimited?: boolean;
  geoBlocked?: boolean;
  error?: string;
}> {
  const logs: ScanLogLine[] = [];
  const statusAtivos = (input.statusFiltros || []).filter(Boolean) as FiltroStatusId[];
  const materiaAtivos = (input.materiaFiltros || []).filter(Boolean) as FiltroMateriaId[];

  if (!statusAtivos.length && !materiaAtivos.length) {
    return {
      success: false,
      items: [],
      logs: [log("err", "Marque Filtro 1 (status) e/ou Filtro 2 (matéria).")],
      query: "",
      queryIndex: 0,
      pagina: 1,
      hasMore: false,
      bruto: 0,
      totalQueries: 0,
      error: "filtros",
    };
  }

  const queries = buildDjenQueries(statusAtivos, materiaAtivos, input.cnpj);
  if (!queries.length) {
    return {
      success: false,
      items: [],
      logs: [log("err", "Nenhuma query gerada.")],
      query: "",
      queryIndex: 0,
      pagina: 1,
      hasMore: false,
      bruto: 0,
      totalQueries: 0,
      error: "query",
    };
  }

  const qi = Math.max(0, Math.min(input.queryIndex || 0, queries.length - 1));
  const pagina = Math.max(1, input.pagina || 1);
  const q = queries[qi];
  const dataFim = input.dataFim || new Date().toISOString().slice(0, 10);
  const dataInicio =
    input.dataInicio ||
    new Date(Date.now() - Math.min(Math.max(Number(input.dias) || 14, 1), 30) * 86400000)
      .toISOString()
      .slice(0, 10);
  const sigla = input.siglaTribunal?.trim().toUpperCase() || undefined;
  const exclude = new Set((input.excludeCnjs || []).map((c) => c.replace(/\D/g, "")));
  const cnpjFilter = String(input.cnpj || "").replace(/\D/g, "");

  logs.push(
    log(
      "info",
      `Query ${qi + 1}/${queries.length} “${q}” · pág ${pagina} · ${dataInicio}→${dataFim}` +
        (sigla ? ` · ${sigla}` : "") +
        (cnpjFilter ? ` · CNPJ ${cnpjFilter}` : "")
    )
  );

  const res = await fetchDjenPorTexto(q, {
    dataInicio,
    dataFim,
    pagina,
    itensPorPagina: 100,
    siglaTribunal: sigla,
  });

  if ((res as any).isGeoBlocked) {
    return {
      success: false,
      items: [],
      logs: [...logs, log("err", "DJEN 403 geo-block — Vercel em São Paulo (gru1).")],
      query: q,
      queryIndex: qi,
      pagina,
      hasMore: false,
      bruto: 0,
      totalQueries: queries.length,
      geoBlocked: true,
      error: res.error,
    };
  }
  if (res.isRateLimited) {
    return {
      success: false,
      items: [],
      logs: [...logs, log("warn", "429 rate limit")],
      query: q,
      queryIndex: qi,
      pagina,
      hasMore: true,
      bruto: 0,
      totalQueries: queries.length,
      rateLimited: true,
      error: res.error,
    };
  }
  if (!res.success) {
    return {
      success: false,
      items: [],
      logs: [...logs, log("err", res.error || "Falha DJEN")],
      query: q,
      queryIndex: qi,
      pagina,
      hasMore: false,
      bruto: 0,
      totalQueries: queries.length,
      error: res.error,
    };
  }

  const bruto = res.items?.length || 0;
  logs.push(log("info", `API: ${bruto} brutos`));

  const items: ProcessoDjenReal[] = [];
  let skipSigilo = 0,
    skipCnj = 0,
    skipNome = 0,
    skipTeor = 0,
    skipDup = 0,
    skipFiltro = 0,
    skipCnpj = 0;

  for (const it of res.items || []) {
    const blob = `${it.nomeClasse || ""} ${it.texto || ""} ${it.tipoComunicacao || ""}`;
    if (isSegredoOuSigilo(blob)) {
      skipSigilo++;
      continue;
    }
    const digits = extractCnjSeguro(it.numero_processo, it.texto, {
      siglaTribunal: sigla || it.siglaTribunal,
    });
    if (!digits) {
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
    if (cnpjFilter && !textoTemCnpj(blob, cnpjFilter)) {
      skipCnpj++;
      continue;
    }

    const gate = passaFiltrosCombinados(blob, statusAtivos, materiaAtivos);
    if (!gate.ok) {
      skipFiltro++;
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

    const telTeor = extractTelefoneSeguro(it.texto);
    const statusLabel =
      FILTROS_STATUS.find((f) => f.id === gate.status)?.nomeTribunal || gate.status || "";
    const materiaLabel = gate.materiaHits
      .map((id) => FILTROS_MATERIA.find((f) => f.id === id)?.nomeTribunal)
      .filter(Boolean)
      .join(" · ");

    items.push({
      processo: formatCnjMasked(digits),
      nome_completo: nome,
      telefone: telTeor,
      email: "",
      cpf: "",
      cnpj: cnpjFilter.length === 14 ? cnpjFilter : "",
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
      situacao_hint: [statusLabel, materiaLabel].filter(Boolean).join(" · "),
      status_detectado: gate.status || "",
      tribunal: String(it.siglaTribunal || sigla || "").toUpperCase(),
      data: String(it.data_disponibilizacao || "").slice(0, 10),
      link: buildLink(it, digits),
      filtros: [...(gate.status ? [gate.status] : []), ...gate.materiaHits].join("|"),
      consultavel: true,
    });
  }

  logs.push(
    log(
      "ok",
      `Aceitos ${items.length} · sigilo:${skipSigilo} cnj:${skipCnj} filtro:${skipFiltro} cnpj:${skipCnpj} nome:${skipNome} teor:${skipTeor} dup:${skipDup}`
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
    totalQueries: queries.length,
  };
}

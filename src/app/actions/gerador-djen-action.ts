"use server";

import { fetchDjenPorTexto } from "@/lib/djen-busca-texto";
import {
  FILTROS_STATUS,
  FILTROS_MATERIA,
  passaFiltrosCombinados,
  textoTemCnpj,
  extractCnjSeguro,
  extractTelefoneSeguro,
  extractNomeCompletoFromDjen,
  formatCnjMasked,
  isSegredoOuSigilo,
  teorConsultavel,
  classificarSentenca,
  type FiltroStatusId,
  type FiltroMateriaId,
  type ProcessoDjenReal,
  type ScanLogLine,
} from "@/lib/revisional-tribunal-filtros";

function log(level: ScanLogLine["level"], text: string): ScanLogLine {
  return { ts: new Date().toISOString().slice(11, 19), level, text };
}

function cnjSoMascara(apiField: string | null | undefined): string | null {
  // Aceita SOMENTE o campo oficial da API (número com máscara).
  // Nunca extrai CNJ do texto — o teor cita outros processos.
  const d = String(apiField || "").replace(/\D/g, "");
  if (d.length !== 20) return null;
  return d;
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
  // Enrich desativado por design nesta versão (sem API externa).
  return { enabled: false, urlSet: false, tokenSet: false, ready: false };
}

export async function scanDjenPaginaAction(input: {
  statusFiltros: FiltroStatusId[];
  materiaFiltros: FiltroMateriaId[];
  queryIndex: number;
  pagina: number;
  dataInicio?: string;
  dataFim?: string;
  siglaTribunal?: string;
  excludeCnjs?: string[];
  cnpj?: string;
}) {
  const logs: ScanLogLine[] = [];
  try {
    const statusAtivos = (input.statusFiltros || []) as FiltroStatusId[];
    const materiaAtivos = (input.materiaFiltros || []) as FiltroMateriaId[];
    if (!statusAtivos.length && !materiaAtivos.length) {
      return {
        success: false,
        items: [] as ProcessoDjenReal[],
        logs: [log("err", "Marque F1 e/ou F2")],
        query: "",
        queryIndex: 0,
        pagina: 1,
        hasMore: false,
        bruto: 0,
        totalQueries: 0,
        error: "filtros",
      };
    }
    const queries = queriesCurta(statusAtivos, materiaAtivos);
    const qi = Math.max(0, Math.min(input.queryIndex || 0, Math.max(queries.length - 1, 0)));
    const q = queries[qi] || "revisional";
    const pagina = Math.max(1, input.pagina || 1);
    const dataFim = input.dataFim || new Date().toISOString().slice(0, 10);
    const dataInicio = input.dataInicio || new Date(Date.now() - 14 * 86400000).toISOString().slice(0, 10);
    const sigla = input.siglaTribunal?.trim().toUpperCase() || undefined;
    const exclude = new Set((input.excludeCnjs || []).map((c) => c.replace(/\D/g, "")));
    const cnpjFilter = String(input.cnpj || "").replace(/\D/g, "");

    logs.push(log("info", `Texto “${q}” · pág ${pagina} · ${dataInicio}→${dataFim}`));
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
        logs: [...logs, log("err", res.error || "403 geo — DJEN bloqueou esta região")],
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
        logs: [...logs, log("warn", "429 — DJEN pediu pausa; retry automático")],
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
      const html = !!(res as any).isHtmlBlock || /HTML/i.test(String(res.error || ""));
      return {
        success: false,
        items: [],
        logs: [
          ...logs,
          log("err", html ? "DJEN devolveu bloqueio WAF/HTML (não é JSON) — tente de novo em instantes" : String(res.error || "falha na consulta")),
        ],
        query: q,
        queryIndex: qi,
        pagina,
        hasMore: false,
        bruto: 0,
        totalQueries: queries.length,
        htmlBlocked: html,
        error: res.error,
      };
    }

    const bruto = res.items?.length || 0;
    logs.push(log("info", `API: ${bruto} publicações na página`));

    const items: ProcessoDjenReal[] = [];
    let skipSigilo = 0, skipCnj = 0, skipDup = 0, skipTeor = 0, skipCnpj = 0, skipFiltro = 0, skipNome = 0;

    for (const it of res.items || []) {
      const blob = `${it.nomeClasse || ""} ${it.texto || ""}`;
      if (isSegredoOuSigilo(blob)) { skipSigilo++; continue; }

      // CRÍTICO: número do processo = SEMPRE o campo oficial da API.
      const digits = cnjSoMascara(it.numero_processo);
      if (!digits) { skipCnj++; continue; }
      if (exclude.has(digits)) { skipDup++; continue; }
      if (!teorConsultavel(it.texto)) { skipTeor++; continue; }
      if (cnpjFilter && !textoTemCnpj(blob, cnpjFilter)) { skipCnpj++; continue; }

      const gate = passaFiltrosCombinados(blob, statusAtivos, materiaAtivos);
      if (!gate.ok) { skipFiltro++; continue; }

      const nome =
        extractNomeCompletoFromDjen({
          texto: it.texto,
          destinatarios: (it as any).destinatarios,
        }) || "";
      if (!nome) { skipNome++; continue; }

      items.push(toRow(it, digits, gate, nome, sigla));
    }

    logs.push(
      log(
        items.length ? "ok" : "warn",
        `Aceitos ${items.length}/${bruto} · sigilo:${skipSigilo} sem_num:${skipCnj} dup:${skipDup} teor:${skipTeor} cnpj:${skipCnpj} filtro_F1F2:${skipFiltro} sem_nome:${skipNome}`
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
  } catch (e: any) {
    // Nunca deixar o log mudo: qualquer erro vira linha vermelha no console.
    return {
      success: false,
      items: [],
      logs: [...logs, log("err", `Erro interno: ${e?.message || String(e)}`)],
      query: "",
      queryIndex: 0,
      pagina: 1,
      hasMore: false,
      bruto: 0,
      totalQueries: 0,
      error: e?.message || String(e),
    };
  }
}

// ---------- helpers ----------

function toRow(it: any, digits: string, gate: any, nome: string, sigla?: string): ProcessoDjenReal {
  const tel = extractTelefoneSeguro(it.texto);
  const statusLabel = FILTROS_STATUS.find((f) => f.id === gate.status)?.nomeTribunal || gate.status || "";
  const matLabel = (gate.materiaHits || [])
    .map((id: string) => FILTROS_MATERIA.find((f) => f.id === id)?.nomeTribunal)
    .filter(Boolean)
    .join(" · ");
  const decisao = classificarSentenca(String(it.texto || ""));
  const decisaoLabel = {
    extinto_sem_merito: "Extinto sem resolução do mérito",
    extinto_com_merito: "Extinto com resolução do mérito",
    procedente: "Sentença procedente",
    improcedente: "Sentença improcedente",
    procedente_parcial: "Sentença procedente em parte",
    nao_classificada: "Sentença não classificada",
  }[decisao];
  return {
    processo: formatCnjMasked(digits),
    nome_completo: nome,
    telefone: tel,
    email: "",
    cpf: "",
    cnpj: "",
    endereco: "",
    cep: "",
    bairro: "",
    municipio: "",
    uf: "",
    situacao_cadastral: "",
    telefone_fonte: tel ? "teor_djen_publico" : "",
    enrich_fonte: "",
    classe: String(it.nomeClasse || "").trim(),
    assunto_ou_teor: String(it.texto || "").replace(/\s+/g, " ").trim().slice(0, 240),
    situacao_hint: [statusLabel, matLabel, decisaoLabel].filter(Boolean).join(" · "),
    status_detectado: gate.status || decisao,
    tribunal: String(it.siglaTribunal || sigla || "").toUpperCase(),
    data: String(it.data_disponibilizacao || "").slice(0, 10),
    link: buildLink(it, digits),
    filtros: [gate.status, ...(gate.materiaHits || [])].filter(Boolean).join("|"),
    consultavel: true,
  };
}

function queriesCurta(status: FiltroStatusId[], materia: FiltroMateriaId[]): string[] {
  const qs: string[] = [];
  if (status.includes("extinto_sem_merito")) qs.push("art. 485", "485 CPC", "sem resolucao do merito");
  if (status.includes("extinto_com_merito")) qs.push("art. 487");
  if (status.includes("encerrado")) qs.push("arquivamento");
  if (status.includes("ativo")) qs.push("intime-se");
  for (const m of materia) {
    const f = FILTROS_MATERIA.find((x) => x.id === m);
    if (f) qs.push(f.djenQuery);
  }
  if (status.includes("extinto_sem_merito") && materia.includes("acao_revisional")) qs.unshift("485 revisional");
  return [...new Set(qs)].slice(0, 10);
}

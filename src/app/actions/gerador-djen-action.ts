"use server";

import { fetchDjenPorTexto } from "@/lib/djen-busca-texto";
import { fetchDjenComunicacoes } from "@/lib/djen";
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

function buildLink(it: any, digits: string): string {
  if (String(it?.link || "").startsWith("http")) return String(it.link);
  if (it?.hash) return `https://comunica.pje.jus.br/consulta?hash=${encodeURIComponent(it.hash)}`;
  return `https://comunica.pje.jus.br/#/consulta?numeroProcesso=${encodeURIComponent(formatCnjMasked(digits))}`;
}

function toRow(it: any, digits: string, gate: any, sigla?: string): ProcessoDjenReal {
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
    nome_completo:
      extractNomeCompletoFromDjen({ texto: it.texto, destinatarios: it.destinatarios }) || "—",
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

export async function enrichmentConfigAction() {
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
    itensPorPagina: 50,
    siglaTribunal: sigla,
  });

  if ((res as any).isGeoBlocked) {
    return {
      success: false,
      items: [],
      logs: [...logs, log("err", res.error || "403")],
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
      logs: [...logs, log("warn", "429")],
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
        log("warn", html ? "WAF/HTML no texto → use fallback carteira (modo Auto)" : res.error || "falha"),
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

  const items: ProcessoDjenReal[] = [];
  for (const it of res.items || []) {
    const blob = `${it.nomeClasse || ""} ${it.texto || ""}`;
    if (isSegredoOuSigilo(blob)) continue;
    const digits = extractCnjSeguro(it.numero_processo, it.texto, {
      siglaTribunal: sigla || it.siglaTribunal,
    });
    if (!digits || exclude.has(digits)) continue;
    if (!teorConsultavel(it.texto)) continue;
    if (cnpjFilter && !textoTemCnpj(blob, cnpjFilter)) continue;
    const gate = passaFiltrosCombinados(blob, statusAtivos, materiaAtivos);
    if (!gate.ok) continue;
    if (!extractNomeCompletoFromDjen({ texto: it.texto, destinatarios: (it as any).destinatarios })) continue;
    items.push(toRow(it, digits, gate, sigla));
  }
  logs.push(log("ok", `Aceitos texto: ${items.length} / brutos ${res.items?.length || 0}`));
  return {
    success: true,
    items,
    logs,
    query: q,
    queryIndex: qi,
    pagina,
    hasMore: (res.items?.length || 0) >= 40,
    bruto: res.items?.length || 0,
    totalQueries: queries.length,
  };
}

/** Mesmo fluxo do scanner: CNJ da carteira → fetchDjenComunicacoes */
export async function scanCarteiraDjenAction(input: {
  statusFiltros: FiltroStatusId[];
  materiaFiltros: FiltroMateriaId[];
  dataInicio?: string;
  dataFim?: string;
  siglaTribunal?: string;
  excludeCnjs?: string[];
  cnpj?: string;
  limit?: number;
  offset?: number;
}) {
  const logs: ScanLogLine[] = [];
  const statusAtivos = (input.statusFiltros || []) as FiltroStatusId[];
  const materiaAtivos = (input.materiaFiltros || []) as FiltroMateriaId[];
  const dataFim = input.dataFim || new Date().toISOString().slice(0, 10);
  const dataInicio = input.dataInicio || new Date(Date.now() - 90 * 86400000).toISOString().slice(0, 10);
  const sigla = input.siglaTribunal?.trim().toUpperCase() || undefined;
  const exclude = new Set((input.excludeCnjs || []).map((c) => c.replace(/\D/g, "")));
  const cnpjFilter = String(input.cnpj || "").replace(/\D/g, "");
  const limit = Math.min(Math.max(Number(input.limit) || 25, 5), 40);
  const offset = Math.max(Number(input.offset) || 0, 0);

  logs.push(log("info", `Carteira→DJEN por CNJ · offset ${offset} · lote ${limit}`));

  let rows: any[] = [];
  let totalCarteira = 0;
  try {
    const { getUserContext, getSupabaseAdmin } = await import("@/lib/server-db");
    const ctx = await getUserContext();
    if (!ctx.empresa_id) {
      logs.push(log("err", "Sem empresa_id — faça login"));
      return { success: false, items: [] as ProcessoDjenReal[], logs, scanned: 0, totalCarteira: 0, hasMore: false, tentados: [] as string[] };
    }
    const admin = await getSupabaseAdmin();
    const { data, error, count } = await admin
      .from("processos")
      .select("protocolo_ref, dados", { count: "exact" })
      .eq("empresa_id", ctx.empresa_id)
      .range(offset, offset + limit - 1);
    if (error) {
      logs.push(log("err", error.message));
      return { success: false, items: [], logs, scanned: 0, totalCarteira: 0, hasMore: false, tentados: [] as string[] };
    }
    rows = data || [];
    totalCarteira = typeof count === "number" ? count : rows.length + offset;
  } catch (e: any) {
    logs.push(log("err", e?.message || "Falha carteira"));
    return { success: false, items: [], logs, scanned: 0, totalCarteira: 0, hasMore: false, tentados: [] as string[] };
  }

  const items: ProcessoDjenReal[] = [];
  const tentados: string[] = [];
  let scanned = 0;
  let rateLimited = false;
  let geoBlocked = false;

  for (const row of rows) {
    const proto = String(row.protocolo_ref || row.dados?.protocolo || row.dados?.cnj || "").replace(/\D/g, "");
    if (proto.length !== 20 || exclude.has(proto)) continue;
    scanned++;
    tentados.push(proto);
    logs.push(log("info", `CNJ ${scanned}/${rows.length} · consultando ${formatCnjMasked(proto)}`));
    const djen = await fetchDjenComunicacoes(proto, { siglaTribunal: sigla, dataInicio, dataFim });
    if (djen.isGeoBlocked) {
      geoBlocked = true;
      logs.push(log("err", "403 no CNJ"));
      break;
    }
    if (djen.isRateLimited) {
      rateLimited = true;
      logs.push(log("warn", "429 no CNJ"));
      break;
    }
    if (!djen.success || !djen.items?.length) {
      logs.push(log(djen.success ? "info" : "warn", djen.success ? `CNJ ${formatCnjMasked(proto)} · sem comunicação pública no intervalo` : `CNJ ${formatCnjMasked(proto)} · consulta falhou: ${djen.error || "resposta inválida"}`));
      continue;
    }
    for (const it of djen.items) {
      const blob = `${it.nomeClasse || ""} ${it.texto || ""}`;
      if (isSegredoOuSigilo(blob) || !teorConsultavel(it.texto)) continue;
      if (cnpjFilter && !textoTemCnpj(blob, cnpjFilter)) continue;
    const gate = passaFiltrosCombinados(blob, statusAtivos, materiaAtivos);
    if (!gate.ok) continue;
    if (!extractNomeCompletoFromDjen({ texto: it.texto, destinatarios: it.destinatarios })) {
      logs.push(log("skip", `CNJ ${formatCnjMasked(proto)} · publicação sem nome de parte`));
      continue;
    }
    const digits = extractCnjSeguro(it.numero_processo, it.texto, { siglaTribunal: sigla }) || proto;
    items.push(toRow(it, digits, gate, sigla));
      exclude.add(digits);
      break;
    }
    await new Promise((r) => setTimeout(r, 1000));
  }

  logs.push(log("ok", `Carteira vistos ${scanned} · aceitos ${items.length}`));
  return {
    success: true,
    items,
    logs,
    scanned,
    totalCarteira,
    hasMore: offset + limit < totalCarteira,
    rateLimited,
    geoBlocked,
    tentados,
  };
}

/**
 * Sorteio aleatório DENTRO da carteira da empresa (CNJs reais, um por um).
 * Para cada CNJ sorteado consulta o DJEN no intervalo e classifica
 * EXTINTO / PROCEDENTE / etc. a partir da publicação.
 * A carteira NÃO é lista de exclusão — é o próprio pool do sorteio.
 */
export async function scanAleatorioDjenAction(input: {
  statusFiltros: FiltroStatusId[];
  materiaFiltros: FiltroMateriaId[];
  dataInicio?: string;
  dataFim?: string;
  siglaTribunal?: string;
  excludeCnjs?: string[];
  cnpj?: string;
  lote?: number;
}) {
  const logs: ScanLogLine[] = [];
  const statusAtivos = (input.statusFiltros || []) as FiltroStatusId[];
  const materiaAtivos = (input.materiaFiltros || []) as FiltroMateriaId[];
  const dataFim = input.dataFim || new Date().toISOString().slice(0, 10);
  const dataInicio = input.dataInicio || new Date(Date.now() - 90 * 86400000).toISOString().slice(0, 10);
  const sigla = input.siglaTribunal?.trim().toUpperCase() || undefined;
  const exclude = new Set((input.excludeCnjs || []).map((c) => c.replace(/\D/g, "")));
  const cnpjFilter = String(input.cnpj || "").replace(/\D/g, "");
  const lote = Math.min(Math.max(Number(input.lote) || 8, 3), 12);

  const falha = (msg: string) => ({
    success: false as const,
    items: [] as ProcessoDjenReal[],
    logs: [...logs, log("err", msg)],
    scanned: 0,
    tentados: [] as string[],
    poolRestante: 0,
    poolTotal: 0,
    poolFim: true,
    rateLimited: false,
    geoBlocked: false,
  });

  // 1) Pool do sorteio = carteira da empresa
  let poolTotal = 0;
  let pool: { cnj: string; nomeCarteira: string }[] = [];
  try {
    const { getUserContext, getSupabaseAdmin } = await import("@/lib/server-db");
    const ctx = await getUserContext();
    if (!ctx.empresa_id) return falha("Sem empresa_id — faça login");
    const admin = await getSupabaseAdmin();
    const { data, error } = await admin
      .from("processos")
      .select("protocolo_ref, dados")
      .eq("empresa_id", ctx.empresa_id)
      .limit(5000);
    if (error) return falha(`Carteira: ${error.message}`);
    const all = (data || [])
      .map((r: any) => ({
        cnj: String(r.protocolo_ref || r.dados?.protocolo || r.dados?.cnj || "").replace(/\D/g, ""),
        nomeCarteira: String(
          r.dados?.nome_cliente || r.dados?.nome || r.dados?.cliente || r.dados?.cliente_nome || ""
        )
          .replace(/\s+/g, " ")
          .trim()
          .slice(0, 90),
      }))
      .filter((r) => r.cnj.length === 20);
    poolTotal = all.length;
    pool = all.filter((r) => !exclude.has(r.cnj));
  } catch (e: any) {
    return falha(e?.message || "Falha ao ler carteira");
  }

  const poolRestante = Math.max(poolTotal - exclude.size, 0);
  if (!pool.length) {
    logs.push(log("warn", `Sorteio esgotado · carteira ${poolTotal} CNJs · todos já vistos nesta rodada`));
    return {
      success: true,
      items: [] as ProcessoDjenReal[],
      logs,
      scanned: 0,
      tentados: [] as string[],
      poolRestante: 0,
      poolTotal,
      poolFim: true,
      rateLimited: false,
      geoBlocked: false,
    };
  }

  // 2) Embaralha (Fisher–Yates) e sorteia um por um
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }

  logs.push(
    log("info", `Sorteio na carteira · lote ${Math.min(lote, pool.length)} · pool ${pool.length}/${poolTotal} disponíveis`)
  );

  const items: ProcessoDjenReal[] = [];
  const tentados: string[] = [];
  let scanned = 0;
  let rateLimited = false;
  let geoBlocked = false;

  for (const row of pool) {
    if (scanned >= lote) break;
    const proto = row.cnj;
    exclude.add(proto);
    tentados.push(proto);
    scanned++;

    const djen = await fetchDjenComunicacoes(proto, { siglaTribunal: sigla, dataInicio, dataFim });
    if (djen.isGeoBlocked) {
      geoBlocked = true;
      logs.push(log("err", `Sorteio ${scanned} · ${formatCnjMasked(proto)} · 403 bloqueado`));
      break;
    }
    if (djen.isRateLimited) {
      rateLimited = true;
      logs.push(log("warn", `Sorteio ${scanned} · 429 — pausa no sorteio`));
      break;
    }
    if (!djen.success) {
      logs.push(log("warn", `Sorteio ${scanned} · ${formatCnjMasked(proto)} · consulta falhou: ${djen.error || "resposta inválida"}`));
      continue;
    }
    if (!djen.items?.length) {
      logs.push(log("skip", `Sorteio ${scanned} · ${formatCnjMasked(proto)} · sem publicação no intervalo`));
      continue;
    }

    let aceitou = false;
    for (const it of djen.items) {
      const blob = `${it.nomeClasse || ""} ${it.texto || ""}`;
      if (isSegredoOuSigilo(blob)) continue;
      if (cnpjFilter && !textoTemCnpj(blob, cnpjFilter)) continue;
      const gate = passaFiltrosCombinados(blob, statusAtivos, materiaAtivos);
      if (!gate.ok) continue;
      const nome =
        extractNomeCompletoFromDjen({ texto: it.texto, destinatarios: (it as any).destinatarios }) ||
        row.nomeCarteira;
      if (!nome) {
        logs.push(log("skip", `Sorteio ${scanned} · ${formatCnjMasked(proto)} · publicação sem nome de parte`));
        continue;
      }
      const digits = extractCnjSeguro(it.numero_processo, it.texto, { siglaTribunal: sigla }) || proto;
      const r = toRow(it, digits, gate, sigla);
      r.nome_completo = nome;
      items.push(r);
      const decisao = classificarSentenca(String(it.texto || ""));
      const tag = decisao.startsWith("extinto")
        ? "EXTINTO"
        : decisao === "nao_classificada"
          ? "SEM CLASSIFICAÇÃO"
          : decisao.replace(/_/g, " ").toUpperCase();
      logs.push(log("ok", `Sorteio ${scanned} · ${formatCnjMasked(digits)} · ${tag} · ${nome}`));
      aceitou = true;
      break;
    }
    if (!aceitou) {
      logs.push(log("skip", `Sorteio ${scanned} · ${formatCnjMasked(proto)} · publicação não bateu F1/F2`));
    }
    await new Promise((r) => setTimeout(r, 700));
  }

  const restante = Math.max(poolTotal - exclude.size, 0);
  logs.push(
    log(
      items.length ? "ok" : "info",
      `Sorteio: vistos ${scanned} · aceitos ${items.length} · restam ${restante} na carteira`
    )
  );
  return {
    success: true,
    items,
    logs,
    scanned,
    tentados,
    poolRestante: restante,
    poolTotal,
    poolFim: restante <= 0,
    rateLimited,
    geoBlocked,
  };
}

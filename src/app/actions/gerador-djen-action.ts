"use server";

import { fetchDjenPorTexto } from "@/lib/djen-busca-texto";
import { enrichmentConfigured, enrichmentStatus, lookupEnrichment } from "@/lib/enrichment-lookup";
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

export async function enrichmentConfigAction() {
  return enrichmentStatus();
}

export async function scanDjenPaginaAction(input: {
  filtros: FiltroRevisionalId[];
  queryIndex: number;
  pagina: number;
  dias: number;
  siglaTribunal?: string;
  excludeCnjs?: string[];
  /** chamar sua API de enrich (cpf/email/tel/endereço) */
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
  const doEnrich = input.enrich !== false && enrichmentConfigured();

  logs.push(log("info", `Filtro ${qi + 1}/${defs.length} “${q}” · pág ${pagina} · ${dias}d · enrich ${doEnrich ? "ON" : "off"}`));

  const res = await fetchDjenPorTexto(q, {
    dataInicio,
    dataFim,
    pagina,
    itensPorPagina: 100,
    siglaTribunal: sigla,
  });

  if ((res as any).isGeoBlocked) {
    logs.push(log("err", "DJEN 403 geo-block"));
    return { success: false, items: [], logs, query: q, queryIndex: qi, pagina, hasMore: false, bruto: 0, geoBlocked: true, error: res.error };
  }
  if (res.isRateLimited) {
    logs.push(log("warn", "429 rate limit"));
    return { success: false, items: [], logs, query: q, queryIndex: qi, pagina, hasMore: true, bruto: 0, rateLimited: true, error: res.error };
  }
  if (!res.success) {
    logs.push(log("err", res.error || "Falha DJEN"));
    return { success: false, items: [], logs, query: q, queryIndex: qi, pagina, hasMore: false, bruto: 0, error: res.error };
  }

  const bruto = res.items?.length || 0;
  logs.push(log("info", `API: ${bruto} brutos`));

  const items: ProcessoDjenReal[] = [];
  let skipSigilo = 0, skipCnj = 0, skipNome = 0, skipTeor = 0, skipDup = 0;
  let enrichOk = 0, enrichFail = 0;

  for (const it of res.items || []) {
    const blob = `${it.nomeClasse || ""} ${it.texto || ""} ${it.tipoComunicacao || ""}`;
    if (isSegredoOuSigilo(blob)) { skipSigilo++; continue; }
    const digits = extractCnjRobusto(it.numero_processo, it.texto);
    if (!digits || !cnjDvValido(digits)) { skipCnj++; continue; }
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
    if (!sinal) continue;

    const telTeor = extractTelefoneFromText(it.texto);
    const row: ProcessoDjenReal = {
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
      tribunal: String(it.siglaTribunal || "").toUpperCase(),
      data: String(it.data_disponibilizacao || "").slice(0, 10),
      link: buildLink(it, digits),
      filtros: hits.join("|"),
      consultavel: true,
    };

    // Enrichment: sua API (cpf / email / tel / endereço)
    if (doEnrich) {
      try {
        const en = await lookupEnrichment({
          nome: row.nome_completo,
          cnj: row.processo,
          tribunal: row.tribunal,
        });
        if (en?.ok) {
          enrichOk++;
          row.enrich_fonte = en.fonte || "api-externa";
          if (en.telefone && !row.telefone) {
            row.telefone = en.telefone;
            row.telefone_fonte = en.fonte || "api-externa";
          }
          if (en.email) row.email = en.email;
          if (en.cpf) row.cpf = en.cpf;
          if (en.cnpj) row.cnpj = en.cnpj;
          if (en.complemento) row.endereco = en.complemento;
          if (en.cep) row.cep = en.cep;
          if (en.bairro) row.bairro = en.bairro;
          if (en.municipio) row.municipio = en.municipio;
          if (en.uf) row.uf = en.uf;
          if (en.situacao) row.situacao_cadastral = en.situacao;
        } else {
          enrichFail++;
        }
        // throttle leve
        await new Promise((r) => setTimeout(r, 80));
      } catch {
        enrichFail++;
      }
    }

    items.push(row);
  }

  logs.push(
    log(
      "ok",
      `Aceitos ${items.length} · sigilo:${skipSigilo} cnj:${skipCnj} nome:${skipNome} teor:${skipTeor} dup:${skipDup}` +
        (doEnrich ? ` · enrich ok:${enrichOk} fail:${enrichFail}` : "")
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

"use server";

import { fetchDjenPorTexto } from "@/lib/djen-busca-texto";
import {
  FILTROS_REVISIONAL,
  cnjDvValido,
  extractCnjFromApiField,
  extractCnjFromTextoStrict,
  extractNomeCompletoFromDjen,
  formatCnjMasked,
  isSegredoOuSigilo,
  matchFiltrosRevisional,
  teorConsultavel,
  type FiltroRevisionalId,
  type ProcessoDjenReal,
} from "@/lib/revisional-tribunal-filtros";

function ymdDaysAgo(days: number): string {
  return new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
}
function hojeYmd(): string {
  return new Date().toISOString().slice(0, 10);
}

function buildLink(it: any, digits: string): string {
  const direct = String(it?.link || "").trim();
  if (direct.startsWith("http")) return direct;
  const hash = String(it?.hash || "").trim();
  if (hash) return `https://comunica.pje.jus.br/consulta?hash=${encodeURIComponent(hash)}`;
  const id = it?.id != null ? String(it.id).trim() : "";
  if (id) return `https://comunica.pje.jus.br/consulta?id=${encodeURIComponent(id)}`;
  const masked = formatCnjMasked(digits);
  return `https://comunica.pje.jus.br/#/consulta?numeroProcesso=${encodeURIComponent(masked)}`;
}

/**
 * DJEN real + higiene:
 * - CNJ com DV válido
 * - descarta segredo de justiça / sigilo
 * - exige teor legível OU nome de parte
 * - exige link consultável
 * - match dos filtros ativos
 */
export async function buscarProcessosDjenRevisionalAction(input: {
  filtros: FiltroRevisionalId[];
  dias?: number;
  limite?: number;
  siglaTribunal?: string;
  /** se true, só linhas com nome completo */
  exigirNome?: boolean;
}): Promise<{
  success: boolean;
  message?: string;
  items: ProcessoDjenReal[];
  queries: string[];
  descartados?: { sigilo: number; cnjInvalido: number; semTeor: number; semMatch: number };
  rateLimited?: boolean;
}> {
  const ativos = (input.filtros || []).filter(Boolean) as FiltroRevisionalId[];
  if (!ativos.length) {
    return { success: false, message: "Selecione ao menos um filtro.", items: [], queries: [] };
  }

  const dias = Math.min(Math.max(Number(input.dias) || 7, 1), 45);
  const limite = Math.min(Math.max(Number(input.limite) || 80, 10), 300);
  const exigirNome = input.exigirNome !== false;
  const dataFim = hojeYmd();
  const dataInicio = ymdDaysAgo(dias);
  const sigla = input.siglaTribunal?.trim().toUpperCase() || undefined;

  const queries = FILTROS_REVISIONAL.filter((f) => ativos.includes(f.id)).map((f) => f.djenQuery);

  const byCnj = new Map<string, ProcessoDjenReal>();
  const descartados = { sigilo: 0, cnjInvalido: 0, semTeor: 0, semMatch: 0 };
  let rateLimited = false;
  let lastError = "";

  for (const q of queries) {
    for (const pagina of [1, 2]) {
      if (byCnj.size >= limite) break;
      const res = await fetchDjenPorTexto(q, {
        dataInicio,
        dataFim,
        pagina,
        itensPorPagina: 100,
        siglaTribunal: sigla,
      });
      if (res.isRateLimited) {
        rateLimited = true;
        lastError = res.error || "Rate limit DJEN";
        break;
      }
      if (!res.success) {
        lastError = res.error || "Falha DJEN";
        continue;
      }

      for (const it of res.items || []) {
        const blobSigilo = `${it.nomeClasse || ""} ${it.texto || ""} ${it.tipoComunicacao || ""}`;
        if (isSegredoOuSigilo(blobSigilo)) {
          descartados.sigilo += 1;
          continue;
        }

        const digits =
          extractCnjFromApiField(it.numero_processo) ||
          extractCnjFromTextoStrict(String(it.texto || ""));
        if (!digits || !cnjDvValido(digits)) {
          descartados.cnjInvalido += 1;
          continue;
        }

        if (!teorConsultavel(it.texto) && !(it.destinatarios && it.destinatarios.length)) {
          // sem teor e sem destinatário = não consultável na prática
          descartados.semTeor += 1;
          continue;
        }

        const blob = `${it.nomeClasse || ""} ${it.texto || ""}`;
        const { ok, hits } = matchFiltrosRevisional(blob, ativos);
        // Resultado (extinção etc.) exige hit; classe/assunto: hit OU veio da query dedicada
        const precisaHitForte = ativos.every((id) =>
          ["extinto_sem_merito", "extinto_com_merito", "improcedente", "procedente_parcial"].includes(id)
        );
        if (precisaHitForte && !ok) {
          descartados.semMatch += 1;
          continue;
        }
        // Mistura classe+assunto: prefere ter ao menos 1 hit de assunto/classe
        if (!ok && ativos.some((id) => ["acao_revisional", "alienacao_fiduciaria", "procedimento_comum_civel"].includes(id))) {
          // ainda aceita se a query que trouxe o item for de um filtro ativo (já está)
          // mas exige palavra revisional/bancário/fiduci no texto
          const n = blob.toLowerCase();
          const temSinal =
            /revisional|fiduci|banc[aá]ri|financiamento|contrato/.test(n) ||
            /procedimento\s+comum/.test(n);
          if (!temSinal) {
            descartados.semMatch += 1;
            continue;
          }
        }

        const nome = extractNomeCompletoFromDjen({
          texto: it.texto,
          destinatarios: (it as any).destinatarios,
        });
        if (exigirNome && !nome) {
          descartados.semTeor += 1;
          continue;
        }

        const link = buildLink(it, digits);
        const row: ProcessoDjenReal = {
          processo: formatCnjMasked(digits),
          nome_completo: nome,
          classe: String(it.nomeClasse || "").trim(),
          assunto_ou_teor: String(it.texto || "").replace(/\s+/g, " ").trim().slice(0, 220),
          situacao_hint:
            hits
              .map((id) => FILTROS_REVISIONAL.find((f) => f.id === id)?.nomeTribunal)
              .filter(Boolean)
              .join(" · ") || String(it.tipoComunicacao || ""),
          tribunal: String(it.siglaTribunal || "").toUpperCase(),
          data: String(it.data_disponibilizacao || "").slice(0, 10),
          link,
          filtros: hits.join("|"),
          consultavel: true,
        };

        const prev = byCnj.get(digits);
        if (!prev || (nome && !prev.nome_completo)) byCnj.set(digits, row);
        if (byCnj.size >= limite) break;
      }
      if (rateLimited) break;
      await new Promise((r) => setTimeout(r, 150));
    }
    if (rateLimited) break;
    await new Promise((r) => setTimeout(r, 180));
  }

  const items = [...byCnj.values()].sort((a, b) => (b.data || "").localeCompare(a.data || ""));

  if (!items.length) {
    let msg = `Nenhum processo consultável no DJEN (${dataInicio} → ${dataFim}).`;
    if (rateLimited) msg = "DJEN limitou (429). Reduza filtros/dias e tente de novo.";
    if (lastError && !rateLimited) msg = lastError;
    msg += ` Descartados: sigilo ${descartados.sigilo}, CNJ inválido ${descartados.cnjInvalido}, sem teor/nome ${descartados.semTeor}, fora do filtro ${descartados.semMatch}.`;
    return { success: false, message: msg, items: [], queries, descartados, rateLimited };
  }

  return {
    success: true,
    message: `${items.length} processos reais e consultáveis · ${dataInicio} → ${dataFim} · descartados sigilo:${descartados.sigilo} cnj:${descartados.cnjInvalido}`,
    items,
    queries,
    descartados,
    rateLimited,
  };
}

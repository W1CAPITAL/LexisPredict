"use server";

import { fetchDjenPorTexto } from "@/lib/djen-busca-texto";
import {
  FILTROS_REVISIONAL,
  extractCnjDigits,
  extractNomeCompletoFromDjen,
  formatCnjMasked,
  matchFiltrosRevisional,
  type FiltroRevisionalId,
  type ProcessoDjenReal,
} from "@/lib/revisional-tribunal-filtros";

function ymdDaysAgo(days: number): string {
  const d = new Date(Date.now() - days * 86400000);
  return d.toISOString().slice(0, 10);
}

function hojeYmd(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Busca processos REAIS no DJEN (Comunica PJe) pelos filtros revisionais.
 * Não inventa CNJ nem nome.
 */
export async function buscarProcessosDjenRevisionalAction(input: {
  filtros: FiltroRevisionalId[];
  /** dias para trás (padrão 14) */
  dias?: number;
  /** teto de linhas únicas por CNJ */
  limite?: number;
  siglaTribunal?: string;
}): Promise<{
  success: boolean;
  message?: string;
  items: ProcessoDjenReal[];
  queries: string[];
  rateLimited?: boolean;
}> {
  const ativos = (input.filtros || []).filter(Boolean);
  if (!ativos.length) {
    return { success: false, message: "Selecione ao menos um filtro.", items: [], queries: [] };
  }

  const dias = Math.min(Math.max(Number(input.dias) || 14, 1), 90);
  const limite = Math.min(Math.max(Number(input.limite) || 100, 10), 500);
  const dataFim = hojeYmd();
  const dataInicio = ymdDaysAgo(dias);
  const sigla = input.siglaTribunal?.trim().toUpperCase() || undefined;

  const queries = FILTROS_REVISIONAL.filter((f) => ativos.includes(f.id)).map((f) => f.djenQuery);

  const byCnj = new Map<string, ProcessoDjenReal>();
  let rateLimited = false;
  let lastError = "";

  // 1 query por filtro ativo (API real). Páginas 1..2 no máximo.
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
        const digits =
          extractCnjDigits(it.numero_processo) ||
          extractCnjDigits(it.texto || "");
        if (!digits) continue;

        const blob = `${it.nomeClasse || ""} ${it.texto || ""} ${it.tipoComunicacao || ""}`;
        const { ok, hits } = matchFiltrosRevisional(blob, ativos);
        // Se o usuário marcou só resultado (ex. extinto sem mérito), exige hit;
        // se marcou classe/assunto, aceita item vindo da query mesmo sem todos os hits.
        const exigeHit = ativos.some((id) =>
          ["extinto_sem_merito", "extinto_com_merito", "improcedente", "procedente_parcial"].includes(id)
        );
        if (exigeHit && !ok) continue;

        const nome = extractNomeCompletoFromDjen({
          texto: it.texto,
          destinatarios: (it as any).destinatarios,
        });

        const prev = byCnj.get(digits);
        if (prev && prev.nome_completo && !nome) continue;

        byCnj.set(digits, {
          processo: formatCnjMasked(digits),
          nome_completo: nome || prev?.nome_completo || "",
          classe: String(it.nomeClasse || prev?.classe || "").trim(),
          assunto_ou_teor: String(it.texto || "")
            .replace(/\s+/g, " ")
            .trim()
            .slice(0, 280),
          situacao_hint: hits
            .map((id) => FILTROS_REVISIONAL.find((f) => f.id === id)?.nomeTribunal)
            .filter(Boolean)
            .join(" · ") || String(it.tipoComunicacao || ""),
          tribunal: String(it.siglaTribunal || "").toUpperCase(),
          data: String(it.data_disponibilizacao || "").slice(0, 10),
          link: String(it.link || (it.hash ? `https://comunica.pje.jus.br/consulta?hash=${it.hash}` : "")),
          filtros: hits.join("|"),
        });
        if (byCnj.size >= limite) break;
      }
      if (rateLimited) break;
      // intervalo leve entre páginas
      await new Promise((r) => setTimeout(r, 120));
    }
    if (rateLimited) break;
    await new Promise((r) => setTimeout(r, 150));
  }

  const items = [...byCnj.values()];
  if (!items.length) {
    return {
      success: false,
      message:
        lastError || (rateLimited
        rateLimited
          ? "DJEN limitou (429). Tente menos filtros ou menos dias."
          : `Nenhum processo real no DJEN para o período ${dataInicio} → ${dataFim}.`,
      items: [],
      queries,
      rateLimited,
    };
  }

  return {
    success: true,
    message: `${items.length} processos reais (DJEN) · ${dataInicio} → ${dataFim}`,
    items,
    queries,
    rateLimited,
  };
}

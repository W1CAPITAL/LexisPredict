"use server";

/**
 * Export “pronto parceiro” — colunas de estágio/confiança (estilo pipeline CRM).
 * CSV UTF-8; sem inventar R$ (faixa só se base existir nos dados).
 */

import type { LegalCase } from "@/lib/case-logic";
import { rankearCasoEspecial } from "@/lib/pipeline-honorarios-especial";
import { analisarHonorariosAReceber } from "@/lib/honorarios-receber";
import { blobDoCaso } from "@/lib/cumprimento-page-helpers";
import { checklistFromCase, checklistAprovado } from "@/lib/checklist-cumprimento";
import { estimarFaixaHonorariosInterna, formatFaixaBRL } from "@/lib/faixa-estimativa-interna";

function csvEscape(v: unknown): string {
  const s = String(v ?? "");
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export async function buildExportProntoParceiroCsv(
  cases: LegalCase[],
  limiar = 55
): Promise<{ success: true; csv: string; count: number } | { success: false; error: string }> {
  try {
    const rows: LegalCase[] = [];
    for (const c of cases || []) {
      try {
        const r = rankearCasoEspecial(c, limiar);
        if (
          r.estagio === "pronto_parceiro" ||
          r.estagio === "hon_receber" ||
          (r.estagio === "teor_ok" && r.scoreOportunidade >= limiar * 0.7)
        ) {
          rows.push(c);
        }
      } catch {
        /* skip */
      }
    }

    const header = [
      "protocolo",
      "cliente",
      "tribunal",
      "estagio",
      "prioridade",
      "score_oportunidade",
      "honorarios_nivel",
      "honorarios_confianca",
      "checklist_ok",
      "data_transito",
      "faixa_hon_interna",
      "motivos",
    ].join(",");

    const lines = [header];
    for (const c of rows) {
      const r = rankearCasoEspecial(c, limiar);
      const blob = blobDoCaso(c);
      const h = analisarHonorariosAReceber(blob, { isProcedente: !!c.is_procedente });
      const chk = checklistFromCase(c as any);
      const d = (c as any).dados && typeof (c as any).dados === "object" ? (c as any).dados : {};
      const base =
        d.valor_causa ||
        d.valor_condenacao ||
        (Array.isArray(d.valores_detectados) ? d.valores_detectados[0] : null);
      const faixa = estimarFaixaHonorariosInterna({
        baseValor: base,
        pctHonorarios: h.percentual,
        aplicarArt523Referencia: false,
      });

      lines.push(
        [
          c.protocolo,
          c.cliente,
          c.tribunal,
          r.estagio,
          r.prioridade,
          r.scoreOportunidade,
          r.honorariosNivel,
          h.confianca,
          checklistAprovado(chk) ? "sim" : "nao",
          c.data_transito_julgado || "",
          formatFaixaBRL(faixa),
          (r.motivos || []).slice(0, 3).join(" | "),
        ]
          .map(csvEscape)
          .join(",")
      );
    }

    return { success: true, csv: lines.join("\n"), count: rows.length };
  } catch (e: any) {
    return { success: false, error: e?.message || "export falhou" };
  }
}

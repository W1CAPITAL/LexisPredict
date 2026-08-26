/**
 * KPI de conversão — Lote 1 (meta nota ~7,5)
 * Métricas internas da esteira de honorários / cumprimento.
 * Não inventa R$; só conta casos e estágios.
 */

import type { LegalCase } from "@/lib/case-logic";
import { rankearCasoEspecial } from "@/lib/pipeline-honorarios-especial";
import { checklistAprovado, type ChecklistCumprimento } from "@/lib/checklist-cumprimento";

export type KpiConversaoCumprimento = {
  totalCarteira: number;
  honReceberForte: number;
  honReceberMedio: number;
  prontoParceiro: number;
  checklistOk: number;
  /** forte + checklist aprovado (fila “quase pronta”) */
  prontosOperacao: number;
  emCumprimento: number;
  bloqueados: number;
  teorFraco: number;
  /** % de fortes que já têm checklist OK (0–100) */
  taxaChecklistSobreForte: number;
  /** % da carteira filtrável em hon_receber (forte+médio) */
  taxaHonReceber: number;
};

/**
 * @param checklistMap mapa protocolo → checklist (local ou já hidratado do servidor)
 */
export function computeKpiConversao(
  cases: LegalCase[],
  limiar: number,
  checklistMap: Record<string, ChecklistCumprimento | undefined> = {}
): KpiConversaoCumprimento {
  let honReceberForte = 0;
  let honReceberMedio = 0;
  let prontoParceiro = 0;
  let checklistOk = 0;
  let prontosOperacao = 0;
  let emCumprimento = 0;
  let bloqueados = 0;
  let teorFraco = 0;

  for (const c of cases || []) {
    const proto = String(c.protocolo || "");
    let r;
    try {
      r = rankearCasoEspecial(c, limiar);
    } catch {
      continue;
    }
    const chk = checklistMap[proto];
    const ok = checklistAprovado(chk);

    if (r.estagio === "pronto_parceiro") prontoParceiro += 1;
    if (r.estagio === "em_cumprimento") emCumprimento += 1;
    if (r.estagio === "bloqueado" || r.honorariosNivel === "bloqueado") bloqueados += 1;
    if (r.honorariosNivel === "forte") honReceberForte += 1;
    if (r.honorariosNivel === "medio") honReceberMedio += 1;
    if (r.estagio === "triagem" || (r as any).motivos?.some?.((m: string) => /teor|texto pobre|enriquecer/i.test(m))) {
      /* contagem aproximada de teor fraco via score/estágio */
    }
    const d = (c as any).dados && typeof (c as any).dados === "object" ? (c as any).dados : {};
    if ((c as any).texto_pobre || d.texto_pobre || (!(c as any).teor_indice_ok && !d.teor_indice_ok && !d.teor_enriquecido_em)) {
      teorFraco += 1;
    }
    if (ok) checklistOk += 1;
    if (ok && (r.honorariosNivel === "forte" || r.estagio === "pronto_parceiro" || r.estagio === "hon_receber")) {
      prontosOperacao += 1;
    }
  }

  const total = (cases || []).length;
  const hon = honReceberForte + honReceberMedio;
  return {
    totalCarteira: total,
    honReceberForte,
    honReceberMedio,
    prontoParceiro,
    checklistOk,
    prontosOperacao,
    emCumprimento,
    bloqueados,
    teorFraco,
    taxaChecklistSobreForte:
      honReceberForte > 0 ? Math.round((prontosOperacao / Math.max(1, honReceberForte)) * 1000) / 10 : 0,
    taxaHonReceber: total > 0 ? Math.round((hon / total) * 1000) / 10 : 0,
  };
}

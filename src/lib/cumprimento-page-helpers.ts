/**
 * Helpers da página Ações Procedentes / Cumprimentos.
 * Isolados em módulo próprio para eliminar TDZ no useMemo do page.tsx
 * (Cannot access before initialization no bundle minificado).
 */

import type { LegalCase } from "@/lib/case-logic";
import { reconciliarFlagsCumprimento } from "@/lib/reconciliar-cumprimento-flags";

export function casePhone(c?: LegalCase | null): string {
  if (!c) return "";
  return String(c.telefone || "").trim();
}

export function diasDesdeTransito(dateStr?: string | null): number | null {
  if (!dateStr) return null;
  try {
    const d = new Date(dateStr);
    const hoje = new Date();
    return Math.floor((hoje.getTime() - d.getTime()) / (1000 * 3600 * 24));
  } catch {
    return null;
  }
}

export function oportunidadeOf(c: LegalCase): {
  elegivel: boolean;
  score: number;
  tipo: string;
  riscos: string[];
  revisao: boolean;
  textoPobre: boolean;
  precisaEnriquecer: boolean;
  teorIndiceOk?: boolean;
  teorSemCredito?: boolean;
} | null {
  const dados = ((c as any).dados && typeof (c as any).dados === "object" ? (c as any).dados : {}) as any;
  const op =
    (c as any).oportunidade_instaurar ||
    dados.oportunidade_instaurar ||
    (c as any).detalhes_execucao?.oportunidade_instaurar ||
    dados.detalhes_execucao?.oportunidade_instaurar;
  if (!op && !(c as any).oportunidade_score && !dados.oportunidade_score) return null;
  return {
    elegivel: !!(op?.elegivel ?? (c as any).oportunidade_elegivel ?? dados.oportunidade_elegivel),
    score: Number(op?.score ?? (c as any).oportunidade_score ?? dados.oportunidade_score ?? 0),
    tipo: String(op?.tipo || dados.oportunidade_tipo || "incerto"),
    riscos: Array.isArray(op?.riscos) ? op.riscos : [],
    revisao: !!(op?.revisao || op?.precisa_revisao),
    textoPobre: !!(op?.texto_pobre || (c as any).texto_pobre || dados.texto_pobre),
    precisaEnriquecer: !!(op?.precisa_enriquecer || op?.texto_pobre || dados.texto_pobre),
    teorIndiceOk: !!(op?.teor_indice_ok || (c as any).teor_indice_ok || dados.teor_indice_ok || dados.teor_enriquecido_em),
    teorSemCredito: !!(op?.teor_sem_credito || dados.teor_sem_credito_detectavel),
  };
}

export function statusExecutivo(c: LegalCase): string {
  const dados = ((c as any).dados && typeof (c as any).dados === "object" ? (c as any).dados : {}) as any;
  const r = reconciliarFlagsCumprimento({
    cumprimento_pendente_necessario: c.cumprimento_pendente_necessario,
    em_cumprimento_sentenca: c.em_cumprimento_sentenca,
    cumprimento_ativo: (c as any).cumprimento_ativo,
    cumprimento_encerrado: (c as any).cumprimento_encerrado,
    status_executivo: (c as any).status_executivo || dados.status_executivo,
    is_procedente: c.is_procedente,
    dados,
  });
  return String(r.status_executivo || "outro");
}

/** true se banco ainda tem as duas flags true (antes da reconciliação visual). */
export function temConflitoFlags(c: LegalCase): boolean {
  const dados = ((c as any).dados && typeof (c as any).dados === "object" ? (c as any).dados : {}) as any;
  const pend = !!(c.cumprimento_pendente_necessario || dados.cumprimento_pendente_necessario);
  const em = !!(
    c.em_cumprimento_sentenca ||
    dados.em_cumprimento_sentenca ||
    (c as any).cumprimento_ativo ||
    dados.cumprimento_ativo
  );
  const enc = !!((c as any).cumprimento_encerrado || dados.cumprimento_encerrado);
  return pend && (em || enc);
}

/**
 * Blob de teor para motor de honorários / crédito / dispositivo.
 * Deve viver FORA do page.tsx (módulo importado) — nunca como const no body do componente.
 */
export function blobDoCaso(c: LegalCase): string {
  const d = ((c as any).dados && typeof (c as any).dados === "object" ? (c as any).dados : {}) as any;
  return [
    (c as any).evento_resumo,
    c.datajud_ultimo_nome,
    (c as any).datajud_ultimo_nome,
    (c as any).procedente_motivo,
    (c as any).cumprimento_sentenca_motivo,
    d.evento_resumo,
    d.djen_ultimo_resumo,
    (c as any).djen_ultimo_resumo,
    d.datajud_ultimo_nome,
    d.procedente_motivo,
    ...(Array.isArray(d.djen_textos) ? d.djen_textos.slice(0, 12) : []),
    ...(Array.isArray(d.movimentos)
      ? d.movimentos.slice(0, 40).map((m: any) => `${m.nome || ""} ${m.complemento || ""}`)
      : []),
  ]
    .filter(Boolean)
    .join("\n");
}

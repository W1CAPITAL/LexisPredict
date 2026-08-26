"use server";

/**
 * Persiste checklist em processos/cases.dados.checklist_cumprimento
 * Usa getSupabaseAdmin de @/lib/server-db (mesmo padrão de case-actions).
 * NÃO importa paths inexistentes (@/lib/supabase/admin etc.) — quebra o webpack.
 */

import type { ChecklistCumprimento } from "@/lib/checklist-cumprimento";
import { normalizeChecklist } from "@/lib/checklist-cumprimento";

export type SaveChecklistResult =
  | { success: true; checklist: ChecklistCumprimento }
  | { success: false; error: string };

export async function saveChecklistCumprimentoAction(input: {
  protocolo: string;
  checklist: ChecklistCumprimento;
  updatedBy?: string | null;
}): Promise<SaveChecklistResult> {
  const protocolo = String(input.protocolo || "").trim();
  if (!protocolo) return { success: false, error: "protocolo obrigatório" };

  const checklist = normalizeChecklist({
    ...input.checklist,
    updatedAt: new Date().toISOString(),
    updatedBy: input.updatedBy ?? input.checklist.updatedBy ?? null,
  });

  try {
    const { getSupabaseAdmin } = await import("@/lib/server-db");
    const admin = await getSupabaseAdmin();
    if (!admin) {
      return { success: false, error: "Supabase admin indisponível — checklist só no localStorage" };
    }

    let row: any = null;
    let table = "processos";

    const q1 = await admin
      .from("processos")
      .select("id, protocolo_ref, dados")
      .eq("protocolo_ref", protocolo)
      .maybeSingle();

    if (q1.data) {
      row = q1.data;
    } else {
      const q2 = await admin
        .from("processos")
        .select("id, protocolo_ref, dados")
        .eq("protocolo", protocolo)
        .maybeSingle();
      if (q2.data) row = q2.data;
    }

    if (!row) {
      table = "cases";
      const q3 = await admin
        .from("cases")
        .select("id, protocolo, dados")
        .eq("protocolo", protocolo)
        .maybeSingle();
      if (q3.data) row = q3.data;
    }

    if (!row) return { success: false, error: "caso não encontrado" };

    const prev = row.dados && typeof row.dados === "object" ? { ...row.dados } : {};
    const nextDados = { ...prev, checklist_cumprimento: checklist };

    const { error } = await admin.from(table).update({ dados: nextDados }).eq("id", row.id);
    if (error) return { success: false, error: error.message };
    return { success: true, checklist };
  } catch (e: any) {
    return { success: false, error: e?.message || "falha ao salvar checklist" };
  }
}

"use server";

/**
 * Lote 1 — persiste checklist de cumprimento em cases.dados.checklist_cumprimento
 * Sem inventar R$. Não altera RLS: usa o mesmo padrão service-role / client do projeto.
 *
 * Se createClientAdmin não existir no repo, adapte o import para o helper Supabase já usado
 * em case-actions.ts (ex.: getServiceSupabase / createServiceRoleClient).
 */

import type { ChecklistCumprimento } from "@/lib/checklist-cumprimento";
import { normalizeChecklist } from "@/lib/checklist-cumprimento";

export type SaveChecklistResult =
  | { success: true; checklist: ChecklistCumprimento }
  | { success: false; error: string };

async function getSupabaseAdmin(): Promise<any> {
  // Tentativas alinhadas a padrões comuns do LexisPredict
  try {
    const mod = await import("@/lib/supabase/admin");
    if (typeof (mod as any).createClientAdmin === "function") return (mod as any).createClientAdmin();
    if (typeof (mod as any).createServiceClient === "function") return (mod as any).createServiceClient();
    if ((mod as any).supabaseAdmin) return (mod as any).supabaseAdmin;
  } catch {
    /* fallthrough */
  }
  try {
    const mod = await import("@/lib/supabase-server");
    if (typeof (mod as any).createServiceRoleClient === "function") return (mod as any).createServiceRoleClient();
    if (typeof (mod as any).getServiceSupabase === "function") return (mod as any).getServiceSupabase();
  } catch {
    /* fallthrough */
  }
  try {
    const mod = await import("@/utils/supabase/admin");
    if (typeof (mod as any).createClient === "function") return (mod as any).createClient();
  } catch {
    /* fallthrough */
  }
  return null;
}

/**
 * Grava checklist no JSON `dados` do caso (por protocolo CNJ).
 * Campos booleanos + updatedAt + updatedBy (auditoria leve).
 */
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

  const sb = await getSupabaseAdmin();
  if (!sb) {
    // Fallback: cliente não consegue persistir no servidor neste ambiente —
    // a UI ainda salva localStorage; não quebra o fluxo.
    return {
      success: false,
      error: "Supabase admin não disponível — checklist ficou só no localStorage",
    };
  }

  try {
    const { data: row, error: readErr } = await sb
      .from("cases")
      .select("id, protocolo, dados")
      .eq("protocolo", protocolo)
      .maybeSingle();

    if (readErr) return { success: false, error: readErr.message };
    if (!row) {
      // tenta coluna cnj
      const { data: row2, error: e2 } = await sb
        .from("cases")
        .select("id, protocolo, dados")
        .eq("cnj", protocolo)
        .maybeSingle();
      if (e2 || !row2) return { success: false, error: "caso não encontrado" };
      return await writeDados(sb, row2, checklist);
    }
    return await writeDados(sb, row, checklist);
  } catch (e: any) {
    return { success: false, error: e?.message || "falha ao salvar checklist" };
  }
}

async function writeDados(
  sb: any,
  row: { id: string | number; dados?: unknown },
  checklist: ChecklistCumprimento
): Promise<SaveChecklistResult> {
  const prev = row.dados && typeof row.dados === "object" ? { ...(row.dados as object) } : {};
  const nextDados = {
    ...prev,
    checklist_cumprimento: checklist,
  };
  const { error } = await sb.from("cases").update({ dados: nextDados }).eq("id", row.id);
  if (error) return { success: false, error: error.message };
  return { success: true, checklist };
}

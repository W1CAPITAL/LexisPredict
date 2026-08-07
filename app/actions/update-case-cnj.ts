"use server";

/**
 * Atualiza o CNJ (protocolo_ref) de um processo sem duplicar linha.
 * Upsert só por protocolo novo deixaria o registro antigo órfão.
 */
import { getUserContext, getSupabaseAdmin } from "@/lib/server-db";
import { LegalCase, processarCaso, extrairTribunal } from "@/lib/case-logic";

export async function updateCaseCnjAction(
  oldProtocolo: string,
  updated: LegalCase
): Promise<{ success: boolean; error?: string; message?: string }> {
  try {
    const { empresa_id, auth_id } = await getUserContext();
    if (!empresa_id) {
      return { success: false, error: "Sessão expirada." };
    }

    const oldDigits = String(oldProtocolo || "").replace(/\D/g, "");
    const newProto = String(updated?.protocolo || "").trim();
    const newDigits = newProto.replace(/\D/g, "");

    if (newDigits.length !== 20) {
      return { success: false, error: "CNJ inválido (20 dígitos)." };
    }

    const admin = await getSupabaseAdmin();

    // Localizar pelo protocolo antigo (várias formas de formatação)
    let dbItem: { id: string; dados: any; protocolo_ref: string } | null = null;

    const { data: byExact } = await admin
      .from("processos")
      .select("id, dados, protocolo_ref")
      .eq("empresa_id", empresa_id)
      .eq("protocolo_ref", oldProtocolo)
      .maybeSingle();

    if (byExact) {
      dbItem = byExact as any;
    } else if (oldDigits.length === 20) {
      const { data: list } = await admin
        .from("processos")
        .select("id, dados, protocolo_ref")
        .eq("empresa_id", empresa_id)
        .limit(3000);
      dbItem =
        (list || []).find(
          (r: any) =>
            String(r.protocolo_ref || "").replace(/\D/g, "") === oldDigits
        ) || null;
    }

    if (!dbItem) {
      return { success: false, error: "Processo não encontrado para o CNJ anterior." };
    }

    // Conflito com outro registro
    const { data: conflict } = await admin
      .from("processos")
      .select("id")
      .eq("empresa_id", empresa_id)
      .eq("protocolo_ref", newProto)
      .neq("id", dbItem.id)
      .maybeSingle();

    if (conflict) {
      return { success: false, error: "Já existe processo com este CNJ na empresa." };
    }

    // Também conflito por dígitos (formatação diferente)
    const { data: allRefs } = await admin
      .from("processos")
      .select("id, protocolo_ref")
      .eq("empresa_id", empresa_id)
      .neq("id", dbItem.id)
      .limit(3000);

    const digitClash = (allRefs || []).find(
      (r: any) => String(r.protocolo_ref || "").replace(/\D/g, "") === newDigits
    );
    if (digitClash) {
      return { success: false, error: "Já existe processo com este CNJ (outra formatação)." };
    }

    const tribunalData = extrairTribunal(newProto);
    const merged = processarCaso({
      ...(typeof dbItem.dados === "object" && dbItem.dados ? dbItem.dados : {}),
      ...updated,
      protocolo: newProto,
      tribunal: tribunalData?.tribunal || updated.tribunal,
      id: updated.id || (dbItem.dados as any)?.id,
    });

    const patch = {
      protocolo_ref: newProto,
      advogado: merged.advogado || "NÃO ATRIBUÍDO",
      escritorio: merged.escritorio || null,
      status: merged.status || "Sem Prazo",
      risco: merged.risco || "Normal",
      tribunal: merged.tribunal || "Outros",
      telefone: merged.telefone || "",
      observacoes: merged.observacao || "",
      dados: { ...merged, protocolo: newProto },
      created_by: (merged as any).created_by || auth_id,
    };

    const { error } = await admin
      .from("processos")
      .update(patch)
      .eq("id", dbItem.id)
      .eq("empresa_id", empresa_id);

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, message: "CNJ atualizado." };
  } catch (e: any) {
    return { success: false, error: e?.message || "Falha ao atualizar CNJ." };
  }
}

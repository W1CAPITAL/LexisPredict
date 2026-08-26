"use server";

/**
 * Persiste estado ético do caso em processos.dados.etica (Supabase via server-db).
 */

import type { EstadoFluxoEtico } from "@/lib/fluxo-etico-fases";
import { normalizeEstadoFluxo } from "@/lib/fluxo-etico-fases";
import type { TermoCienciaState } from "@/lib/termo-ciencia-riscos";
import { emptyTermoCiencia, termoCienciaCompleto } from "@/lib/termo-ciencia-riscos";

export async function saveEticaCasoAction(input: {
  protocolo: string;
  fluxo?: EstadoFluxoEtico;
  termo?: TermoCienciaState;
  updatedBy?: string | null;
}): Promise<{ success: true } | { success: false; error: string }> {
  const protocolo = String(input.protocolo || "").trim();
  if (!protocolo) return { success: false, error: "protocolo obrigatório" };

  try {
    const { getSupabaseAdmin } = await import("@/lib/server-db");
    const admin = await getSupabaseAdmin();
    if (!admin) return { success: false, error: "Supabase admin indisponível" };

    let row: any = null;
    let table = "processos";

    const q1 = await admin
      .from("processos")
      .select("id, protocolo_ref, dados")
      .eq("protocolo_ref", protocolo)
      .maybeSingle();
    if (q1.data) row = q1.data;
    else {
      const q2 = await admin
        .from("processos")
        .select("id, protocolo_ref, dados")
        .eq("protocolo", protocolo)
        .maybeSingle();
      if (q2.data) row = q2.data;
    }
    if (!row) {
      table = "cases";
      const q3 = await admin.from("cases").select("id, protocolo, dados").eq("protocolo", protocolo).maybeSingle();
      if (q3.data) row = q3.data;
    }
    if (!row) return { success: false, error: "caso não encontrado" };

    const prev = row.dados && typeof row.dados === "object" ? { ...row.dados } : {};
    const eticaPrev = (prev as any).etica && typeof (prev as any).etica === "object" ? { ...(prev as any).etica } : {};

    const fluxo = input.fluxo ? normalizeEstadoFluxo(input.fluxo) : eticaPrev.fluxo;
    let termo = input.termo || eticaPrev.termo_ciencia || emptyTermoCiencia();
    if (input.termo && termoCienciaCompleto(input.termo) && !termo.assinadoEm) {
      termo = {
        ...input.termo,
        assinadoEm: new Date().toISOString(),
        assinadoPor: input.updatedBy || null,
      };
    }

    // Sync gates do fluxo a partir do termo
    const fluxoSync = fluxo
      ? {
          ...fluxo,
          termoCienciaRiscosAssinado: termoCienciaCompleto(termo) || !!fluxo.termoCienciaRiscosAssinado,
          updatedAt: new Date().toISOString(),
        }
      : undefined;

    const nextDados = {
      ...prev,
      etica: {
        ...eticaPrev,
        fluxo: fluxoSync || eticaPrev.fluxo,
        termo_ciencia: termo,
        updated_at: new Date().toISOString(),
        updated_by: input.updatedBy || null,
      },
    };

    const { error } = await admin.from(table).update({ dados: nextDados }).eq("id", row.id);
    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e?.message || "falha ao salvar ética" };
  }
}

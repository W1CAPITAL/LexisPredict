"use server";

import type { EstadoFluxoEtico } from "@/lib/fluxo-etico-fases";
import { normalizeEstadoFluxo } from "@/lib/fluxo-etico-fases";
import type { TermoCienciaState } from "@/lib/termo-ciencia-riscos";
import { emptyTermoCiencia, termoCienciaCompleto } from "@/lib/termo-ciencia-riscos";
import type { DiagnosticoContrato } from "@/lib/diagnostico-contrato-etica";
import type { ProtocoloExtrajudicial } from "@/lib/protocolo-extrajudicial";
import { protocoloExtraDocumentado } from "@/lib/protocolo-extrajudicial";
import type { TicketOuvidoria } from "@/lib/ouvidoria-interna";
import type { NpsDiagnostico } from "@/lib/nps-pos-diagnostico";
import type { RegistroSubstabelecimento } from "@/lib/substabelecimento-transparente";

export async function saveEticaCasoAction(input: {
  protocolo: string;
  fluxo?: EstadoFluxoEtico;
  termo?: TermoCienciaState;
  diagnostico?: DiagnosticoContrato;
  protocoloExtra?: ProtocoloExtrajudicial;
  ouvidoria?: TicketOuvidoria[];
  nps?: NpsDiagnostico;
  substabelecimento?: RegistroSubstabelecimento;
  cartaDesistenciaTexto?: string | null;
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
    const eticaPrev =
      (prev as any).etica && typeof (prev as any).etica === "object" ? { ...(prev as any).etica } : {};

    const termo = input.termo || eticaPrev.termo_ciencia || emptyTermoCiencia();
    const termoFinal =
      input.termo && termoCienciaCompleto(input.termo) && !termo.assinadoEm
        ? {
            ...input.termo,
            assinadoEm: new Date().toISOString(),
            assinadoPor: input.updatedBy || null,
          }
        : termo;

    let fluxo = input.fluxo ? normalizeEstadoFluxo(input.fluxo) : eticaPrev.fluxo;
    if (fluxo) {
      const sub = input.substabelecimento || eticaPrev.substabelecimento;
      fluxo = {
        ...fluxo,
        termoCienciaRiscosAssinado:
          termoCienciaCompleto(termoFinal) || !!fluxo.termoCienciaRiscosAssinado,
        diagnosticoEntregue:
          !!input.diagnostico?.parecer ||
          !!fluxo.diagnosticoEntregue ||
          !!eticaPrev.diagnostico?.parecer,
        extrajudicialDocumentado:
          (input.protocoloExtra ? protocoloExtraDocumentado(input.protocoloExtra) : false) ||
          !!fluxo.extrajudicialDocumentado ||
          protocoloExtraDocumentado(eticaPrev.protocolo_extrajudicial),
        contratoHonorariosAdvogadoEntregue:
          !!sub?.contratoHonorariosEntregue || !!fluxo.contratoHonorariosAdvogadoEntregue,
        updatedAt: new Date().toISOString(),
      };
    }

    const nextDados = {
      ...prev,
      etica: {
        ...eticaPrev,
        fluxo: fluxo || eticaPrev.fluxo,
        termo_ciencia: termoFinal,
        diagnostico: input.diagnostico ?? eticaPrev.diagnostico ?? null,
        protocolo_extrajudicial: input.protocoloExtra ?? eticaPrev.protocolo_extrajudicial ?? null,
        ouvidoria: input.ouvidoria ?? eticaPrev.ouvidoria ?? [],
        nps: input.nps ?? eticaPrev.nps ?? null,
        substabelecimento: input.substabelecimento ?? eticaPrev.substabelecimento ?? null,
        carta_desistencia: input.cartaDesistenciaTexto ?? eticaPrev.carta_desistencia ?? null,
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

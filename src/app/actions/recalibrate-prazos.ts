"use server";

/**
 * Recalibra prazos/status da carteira (lógica local).
 * Sempre devolve objeto serializável { success, ... } — evita undefined no client.
 */
import { processarCaso, type LegalCase } from "@/lib/case-logic";

export type RecalibrateResult = {
  success: boolean;
  updated: number;
  message?: string;
  error?: string;
};

export async function recalibrateCasesAction(): Promise<RecalibrateResult> {
  try {
    const mod = await import("@/lib/server-db");
    const getUserContext = (mod as any).getUserContext as () => Promise<{ empresa_id?: string }>;
    const getStoredCasesForEmpresa = (mod as any).getStoredCasesForEmpresa as (
      id: string,
      admin?: boolean
    ) => Promise<LegalCase[]>;
    const saveStoredCasesForEmpresa = (mod as any).saveStoredCasesForEmpresa as (
      cases: LegalCase[],
      id: string,
      admin?: boolean
    ) => Promise<{ success: boolean; message?: string } | undefined | null>;

    if (!getUserContext || !getStoredCasesForEmpresa || !saveStoredCasesForEmpresa) {
      return { success: false, updated: 0, error: "Funções de persistência indisponíveis." };
    }

    const { empresa_id } = await getUserContext();
    if (!empresa_id) {
      return { success: false, updated: 0, error: "Sessão expirada. Faça login novamente." };
    }

    const cases = (await getStoredCasesForEmpresa(empresa_id, true)) || [];
    if (!cases.length) {
      return { success: true, updated: 0, message: "Nenhum processo na carteira." };
    }

    const recalibrated: LegalCase[] = [];
    let skipped = 0;
    for (const c of cases) {
      try {
        if (!c || !c.protocolo) {
          skipped++;
          continue;
        }
        recalibrated.push(processarCaso({ ...c }));
      } catch {
        // mantém o original se processarCaso quebrar em um registro
        recalibrated.push(c);
        skipped++;
      }
    }

    const res = await saveStoredCasesForEmpresa(recalibrated, empresa_id, true);
    if (!res || res.success !== true) {
      return {
        success: false,
        updated: 0,
        error: res?.message || "Falha ao salvar carteira após recalibração.",
      };
    }

    return {
      success: true,
      updated: recalibrated.length,
      message: `Prazos recalibrados em ${recalibrated.length} processo(s)${
        skipped ? ` (${skipped} com aviso)` : ""
      }.`,
    };
  } catch (e: any) {
    console.error("[recalibrateCasesAction]", e);
    return {
      success: false,
      updated: 0,
      error: e?.message || "Erro inesperado na recalibração.",
    };
  }
}

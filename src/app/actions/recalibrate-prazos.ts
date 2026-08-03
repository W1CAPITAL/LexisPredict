"use server";

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
    const getUserContext = (mod as any).getUserContext;
    const getStoredCasesForEmpresa = (mod as any).getStoredCasesForEmpresa;
    const saveStoredCasesForEmpresa = (mod as any).saveStoredCasesForEmpresa;

    if (!getUserContext || !getStoredCasesForEmpresa || !saveStoredCasesForEmpresa) {
      return { success: false, updated: 0, error: "Persistência indisponível neste deploy." };
    }

    const ctx = await getUserContext();
    const empresa_id = ctx?.empresa_id;
    if (!empresa_id) {
      return { success: false, updated: 0, error: "Sessão expirada." };
    }

    const cases: LegalCase[] = (await getStoredCasesForEmpresa(empresa_id, true)) || [];
    if (!cases.length) {
      return { success: true, updated: 0, message: "Nenhum processo." };
    }

    const out: LegalCase[] = [];
    for (const c of cases) {
      try {
        if (!c?.protocolo) continue;
        out.push(processarCaso({ ...c }));
      } catch {
        out.push(c);
      }
    }

    const res = await saveStoredCasesForEmpresa(out, empresa_id, true);
    if (!res || res.success !== true) {
      return {
        success: false,
        updated: 0,
        error: res?.message || "Falha ao salvar após recalibrar.",
      };
    }

    return {
      success: true,
      updated: out.length,
      message: `Prazos recalibrados em ${out.length} processo(s).`,
    };
  } catch (e: any) {
    console.error("[recalibrateCasesAction]", e);
    return { success: false, updated: 0, error: e?.message || "Erro na recalibração." };
  }
}

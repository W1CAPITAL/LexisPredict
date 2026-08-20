"use server";

import { getUserContext } from "@/lib/server-db";
import { normalizePlanId, type PlanId } from "@/lib/planos-pacotes";

export async function listEmpresasParaPlanosAction(): Promise<
  { id: string; nome: string; plano?: string }[]
> {
  const ctx = await getUserContext();
  if (!ctx?.isSuperAdmin && ctx?.cargo !== "Administrador") {
    const id = String(ctx?.empresa_id || "");
    return id ? [{ id, nome: "Minha empresa", plano: "maximo" }] : [];
  }
  try {
    const { listAllEmpresasSystem } = await import("@/lib/server-db");
    const rows = await listAllEmpresasSystem();
    return (rows || []).map((r: any) => ({
      id: String(r.id),
      nome: String(r.nome || r.id),
      plano: r.plano ? normalizePlanId(r.plano) : undefined,
    }));
  } catch {
    return [];
  }
}

export async function salvarPlanoEmpresaAction(empresaId: string, plan: PlanId) {
  const ctx = await getUserContext();
  if (!ctx?.isSuperAdmin) {
    return { ok: false, error: "Só Superadmin altera plano de empresa." };
  }
  const id = String(empresaId || "").trim();
  const p = normalizePlanId(plan);
  if (!id) return { ok: false, error: "empresa inválida" };
  try {
    const { getSupabaseAdmin } = await import("@/lib/server-db");
    const admin = await getSupabaseAdmin();
    const { error } = await admin.from("empresas").update({ plano: p }).eq("id", id);
    if (error) {
      return { ok: true, persisted: false, warning: error.message, plan: p };
    }
    return { ok: true, persisted: true, plan: p };
  } catch (e: any) {
    return { ok: true, persisted: false, warning: e?.message, plan: p };
  }
}

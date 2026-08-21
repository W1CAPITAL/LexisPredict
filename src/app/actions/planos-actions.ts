"use server";

import { getUserContext } from "@/lib/server-db";
import { normalizePlanId, type PlanId } from "@/lib/planos-pacotes";

export async function listEmpresasParaPlanosAction(): Promise<
  { id: string; nome: string; plano?: string; plano_expira_em?: string | null; plano_bloqueado?: boolean }[]
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
      plano_expira_em: r.plano_expira_em ?? null,
      plano_bloqueado: !!r.plano_bloqueado,
    }));
  } catch {
    return [];
  }
}

export async function salvarPlanoEmpresaAction(empresaId: string, plan: PlanId) {
  const ctx = await getUserContext();
  if (!ctx?.isSuperAdmin) {
    return { ok: false, persisted: false, error: "Só Superadmin altera plano de empresa." };
  }
  const id = String(empresaId || "").trim();
  const p = normalizePlanId(plan);
  if (!id) return { ok: false, persisted: false, error: "empresa inválida" };
  try {
    const { getSupabaseAdmin } = await import("@/lib/server-db");
    const admin = await getSupabaseAdmin();
    const { error } = await admin.from("empresas").update({ plano: p }).eq("id", id);
    if (error) {
      return { ok: false, persisted: false, error: error.message, plan: p };
    }
    return { ok: true, persisted: true, plan: p };
  } catch (e: any) {
    return { ok: false, persisted: false, error: e?.message || "falha", plan: p };
  }
}

export async function bloquearEmpresaPlanoAction(empresaId: string, motivo?: string) {
  const ctx = await getUserContext();
  if (!ctx?.isSuperAdmin) return { ok: false, error: "Só Superadmin" };
  const id = String(empresaId || "").trim();
  if (!id) return { ok: false, error: "empresa inválida" };
  try {
    const { getSupabaseAdmin } = await import("@/lib/server-db");
    const admin = await getSupabaseAdmin();
    const { error } = await admin
      .from("empresas")
      .update({ plano_bloqueado: true, plano_bloqueio_motivo: motivo || "inadimplencia" })
      .eq("id", id);
    if (error) return { ok: false, error: error.message, localOnly: true };
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e?.message, localOnly: true };
  }
}

export async function liberarEmpresaPlanoAction(
  empresaId: string,
  plan: PlanId,
  expiresAt: string
) {
  const ctx = await getUserContext();
  if (!ctx?.isSuperAdmin) return { ok: false, error: "Só Superadmin" };
  const id = String(empresaId || "").trim();
  const p = normalizePlanId(plan);
  if (!id) return { ok: false, error: "empresa inválida" };
  try {
    const { getSupabaseAdmin } = await import("@/lib/server-db");
    const admin = await getSupabaseAdmin();
    const { error } = await admin
      .from("empresas")
      .update({
        plano: p,
        plano_bloqueado: false,
        plano_bloqueio_motivo: null,
        plano_expira_em: expiresAt,
      })
      .eq("id", id);
    if (error) return { ok: false, error: error.message, localOnly: true };
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e?.message, localOnly: true };
  }
}

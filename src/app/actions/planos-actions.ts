"use server";

import { getUserContext } from "@/lib/server-db";
import { normalizePlanId, type PlanId } from "@/lib/planos-pacotes";

export type EmpresaPlanoRow = {
  id: string;
  nome: string;
  plano?: string;
  plano_expira_em?: string | null;
  plano_bloqueado?: boolean;
  plano_bloqueio_motivo?: string | null;
};

/** Assinatura da empresa do usuário logado (fonte de verdade no banco). */
export async function getMinhaAssinaturaAction(): Promise<{
  ok: boolean;
  empresaId?: string;
  plan?: PlanId;
  expiresAt?: string | null;
  blocked?: boolean;
  blockedReason?: string | null;
  error?: string;
  missingColumns?: boolean;
}> {
  try {
    const ctx = await getUserContext();
    const empresaId = String(ctx?.empresa_id || "").trim();
    if (!empresaId) return { ok: false, error: "Sem empresa" };

    const { getSupabaseAdmin } = await import("@/lib/server-db");
    const admin = await getSupabaseAdmin();
    if (!admin) return { ok: false, error: "Sem admin client" };

    const { data, error } = await admin
      .from("empresas")
      .select("id, nome, plano, plano_expira_em, plano_bloqueado, plano_bloqueio_motivo")
      .eq("id", empresaId)
      .maybeSingle();

    if (error) {
      const msg = String(error.message || "");
      const missing =
        /plano_bloqueado|plano_expira|column .* does not exist/i.test(msg);
      return { ok: false, error: msg, missingColumns: missing, empresaId };
    }

    return {
      ok: true,
      empresaId,
      plan: data?.plano ? normalizePlanId(data.plano) : "maximo",
      expiresAt: data?.plano_expira_em ?? null,
      blocked: !!data?.plano_bloqueado,
      blockedReason: data?.plano_bloqueio_motivo ?? null,
    };
  } catch (e: any) {
    return { ok: false, error: e?.message || "falha" };
  }
}

export async function listEmpresasParaPlanosAction(): Promise<EmpresaPlanoRow[]> {
  const ctx = await getUserContext();
  if (!ctx?.isSuperAdmin) {
    const id = String(ctx?.empresa_id || "");
    if (!id) return [];
    const mine = await getMinhaAssinaturaAction();
    return [
      {
        id,
        nome: "Minha empresa",
        plano: mine.plan,
        plano_expira_em: mine.expiresAt ?? null,
        plano_bloqueado: !!mine.blocked,
        plano_bloqueio_motivo: mine.blockedReason ?? null,
      },
    ];
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
      plano_bloqueio_motivo: r.plano_bloqueio_motivo ?? null,
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
    if (!admin) return { ok: false, persisted: false, error: "Service role ausente" };
    const { error } = await admin.from("empresas").update({ plano: p }).eq("id", id);
    if (error) {
      return {
        ok: false,
        persisted: false,
        error: error.message,
        plan: p,
        missingColumns: /column .* does not exist/i.test(error.message || ""),
      };
    }
    return { ok: true, persisted: true, plan: p };
  } catch (e: any) {
    return { ok: false, persisted: false, error: e?.message || "falha", plan: p };
  }
}

export async function bloquearEmpresaPlanoAction(empresaId: string, motivo?: string) {
  const ctx = await getUserContext();
  if (!ctx?.isSuperAdmin) return { ok: false, persisted: false, error: "Só Superadmin" };
  const id = String(empresaId || "").trim();
  if (!id) return { ok: false, persisted: false, error: "empresa inválida" };
  try {
    const { getSupabaseAdmin } = await import("@/lib/server-db");
    const admin = await getSupabaseAdmin();
    if (!admin) return { ok: false, persisted: false, error: "Service role ausente (SUPABASE_SERVICE_ROLE_KEY)" };
    const { data, error } = await admin
      .from("empresas")
      .update({
        plano_bloqueado: true,
        plano_bloqueio_motivo: motivo || "inadimplencia",
      })
      .eq("id", id)
      .select("id, plano_bloqueado")
      .maybeSingle();
    if (error) {
      return {
        ok: false,
        persisted: false,
        error: error.message,
        missingColumns: /column .* does not exist|plano_bloqueado/i.test(error.message || ""),
      };
    }
    if (!data) {
      return { ok: false, persisted: false, error: "Empresa não encontrada ou update sem efeito" };
    }
    return { ok: true, persisted: true, blocked: true };
  } catch (e: any) {
    return { ok: false, persisted: false, error: e?.message || "falha" };
  }
}

export async function liberarEmpresaPlanoAction(
  empresaId: string,
  plan: PlanId,
  expiresAt: string
) {
  const ctx = await getUserContext();
  if (!ctx?.isSuperAdmin) return { ok: false, persisted: false, error: "Só Superadmin" };
  const id = String(empresaId || "").trim();
  const p = normalizePlanId(plan);
  if (!id) return { ok: false, persisted: false, error: "empresa inválida" };
  try {
    const { getSupabaseAdmin } = await import("@/lib/server-db");
    const admin = await getSupabaseAdmin();
    if (!admin) return { ok: false, persisted: false, error: "Service role ausente" };
    const { data, error } = await admin
      .from("empresas")
      .update({
        plano: p,
        plano_bloqueado: false,
        plano_bloqueio_motivo: null,
        plano_expira_em: expiresAt,
      })
      .eq("id", id)
      .select("id, plano, plano_bloqueado, plano_expira_em")
      .maybeSingle();
    if (error) {
      return {
        ok: false,
        persisted: false,
        error: error.message,
        missingColumns: /column .* does not exist|plano_/i.test(error.message || ""),
      };
    }
    if (!data) {
      return { ok: false, persisted: false, error: "Empresa não encontrada ou update sem efeito" };
    }
    return {
      ok: true,
      persisted: true,
      plan: p,
      expiresAt: data.plano_expira_em,
      blocked: false,
    };
  } catch (e: any) {
    return { ok: false, persisted: false, error: e?.message || "falha" };
  }
}

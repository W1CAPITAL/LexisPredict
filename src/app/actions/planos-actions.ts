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
  billing_status?: string | null;
  plan_self_service_unlocked?: boolean;
  onboarding_completed?: boolean;
  nav_layout?: "dock" | "vertical" | null;
  sidebar_compact?: boolean;
};

export type MinhaAssinaturaResult = {
  ok: boolean;
  empresaId?: string;
  plan?: PlanId;
  expiresAt?: string | null;
  blocked?: boolean;
  blockedReason?: string | null;
  billingStatus?: string | null;
  selfServiceUnlocked?: boolean;
  onboardingCompleted?: boolean;
  navLayout?: "dock" | "vertical";
  sidebarCompact?: boolean;
  setupRequired?: boolean;
  error?: string;
  missingColumns?: boolean;
};

/** Assinatura da empresa do usuário logado (fonte de verdade no banco). */
export async function getMinhaAssinaturaAction(): Promise<MinhaAssinaturaResult> {
  try {
    const ctx = await getUserContext();
    const empresaId = String(ctx?.empresa_id || "").trim();

    if (!empresaId) {
      return {
        ok: false,
        setupRequired: true,
        error: "Empresa ainda não vinculada ao perfil.",
      };
    }

    const { getSupabaseAdmin } = await import("@/lib/server-db");
    const admin = await getSupabaseAdmin();
    if (!admin) return { ok: false, error: "Cliente administrativo indisponível." };

    const { data, error } = await admin
      .from("empresas")
      .select("id, nome, plano, plano_expira_em, plano_bloqueado, plano_bloqueio_motivo, billing_status, plan_self_service_unlocked, onboarding_completed, nav_layout, sidebar_compact")
      .eq("id", empresaId)
      .maybeSingle();

    if (error) {
      const msg = String(error.message || "");
      const missing =
        /plano_bloqueado|plano_expira|billing_status|column .* does not exist/i.test(msg);
      return { ok: false, error: msg, missingColumns: missing, empresaId };
    }

    if (!data) {
      return {
        ok: false,
        empresaId,
        setupRequired: true,
        error: "Empresa ainda não cadastrada no Supabase.",
      };
    }

    const billingStatus = String(data.billing_status || "").trim().toLowerCase();
    const blockedByBilling = ["past_due", "suspended", "canceled"].includes(billingStatus);

    return {
      ok: true,
      empresaId,
      plan: data.plano ? normalizePlanId(data.plano) : "essencial",
      expiresAt: data.plano_expira_em ?? null,
      blocked: !!data.plano_bloqueado || blockedByBilling,
      blockedReason:
        data.plano_bloqueio_motivo ??
        (blockedByBilling ? billingStatus : null),
      billingStatus: data.billing_status ?? null,
      selfServiceUnlocked: !!data.plan_self_service_unlocked,
      onboardingCompleted: !!data.onboarding_completed,
      navLayout: data.nav_layout === "vertical" ? "vertical" : "dock",
      sidebarCompact: !!data.sidebar_compact,
      setupRequired: false,
    };
  } catch (e: any) {
    return { ok: false, error: e?.message || "Falha ao consultar assinatura." };
  }
}

export async function listEmpresasParaPlanosAction(): Promise<EmpresaPlanoRow[]> {
  const ctx = await getUserContext();

  if (!ctx?.isSuperAdmin) {
    const mine = await getMinhaAssinaturaAction();
    if (!mine.ok || !mine.empresaId) return [];
    return [
      {
        id: mine.empresaId,
        nome: "Minha empresa",
        plano: mine.plan,
        plano_expira_em: mine.expiresAt ?? null,
        plano_bloqueado: !!mine.blocked,
        plano_bloqueio_motivo: mine.blockedReason ?? null,
        billing_status: mine.billingStatus ?? null,
        plan_self_service_unlocked: !!mine.selfServiceUnlocked,
        onboarding_completed: !!mine.onboardingCompleted,
        nav_layout: mine.navLayout || "dock",
        sidebar_compact: !!mine.sidebarCompact,
      },
    ];
  }

  try {
    const { listAllEmpresasSystem } = await import("@/lib/server-db");
    const rows = await listAllEmpresasSystem();
    return (rows || []).map((r: any) => ({
      id: String(r.id),
      nome: String(r.nome || r.id),
      plano: r.plano ? normalizePlanId(r.plano) : "essencial",
      plano_expira_em: r.plano_expira_em ?? null,
      plano_bloqueado: !!r.plano_bloqueado,
      plano_bloqueio_motivo: r.plano_bloqueio_motivo ?? null,
      billing_status: r.billing_status ?? null,
      plan_self_service_unlocked: !!r.plan_self_service_unlocked,
      onboarding_completed: !!r.onboarding_completed,
      nav_layout: r.nav_layout === "vertical" ? "vertical" : "dock",
      sidebar_compact: !!r.sidebar_compact,
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
  if (!id) return { ok: false, persisted: false, error: "Empresa inválida." };

  try {
    const { getSupabaseAdmin } = await import("@/lib/server-db");
    const admin = await getSupabaseAdmin();
    if (!admin) return { ok: false, persisted: false, error: "Service role ausente." };

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
    return { ok: false, persisted: false, error: e?.message || "Falha.", plan: p };
  }
}

export async function bloquearEmpresaPlanoAction(empresaId: string, motivo?: string) {
  const ctx = await getUserContext();
  if (!ctx?.isSuperAdmin) return { ok: false, persisted: false, error: "Só Superadmin." };

  const id = String(empresaId || "").trim();
  if (!id) return { ok: false, persisted: false, error: "Empresa inválida." };

  try {
    const { getSupabaseAdmin } = await import("@/lib/server-db");
    const admin = await getSupabaseAdmin();
    if (!admin) return { ok: false, persisted: false, error: "Service role ausente." };

    const { data, error } = await admin
      .from("empresas")
      .update({
        plano_bloqueado: true,
        plano_bloqueio_motivo: motivo || "inadimplencia",
        billing_status: "suspended",
      })
      .eq("id", id)
      .select("id, plano, plano_bloqueado")
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
      return { ok: false, persisted: false, error: "Empresa não encontrada ou update sem efeito." };
    }

    try {
      await admin.from("assinaturas").upsert(
        {
          empresa_id: id,
          plano: normalizePlanId((data as any).plano || "essencial"),
          status: "suspended",
          updated_at: new Date().toISOString(),
        },
        { onConflict: "empresa_id" }
      );
    } catch {
      /* espelho best-effort */
    }

    return { ok: true, persisted: true, blocked: true };
  } catch (e: any) {
    return { ok: false, persisted: false, error: e?.message || "Falha." };
  }
}

export async function liberarEmpresaPlanoAction(
  empresaId: string,
  plan: PlanId,
  expiresAt: string
) {
  const ctx = await getUserContext();
  if (!ctx?.isSuperAdmin) return { ok: false, persisted: false, error: "Só Superadmin." };

  const id = String(empresaId || "").trim();
  const p = normalizePlanId(plan);
  if (!id) return { ok: false, persisted: false, error: "Empresa inválida." };

  try {
    const { getSupabaseAdmin } = await import("@/lib/server-db");
    const admin = await getSupabaseAdmin();
    if (!admin) return { ok: false, persisted: false, error: "Service role ausente." };

    const { data, error } = await admin
      .from("empresas")
      .update({
        plano: p,
        plano_bloqueado: false,
        plano_bloqueio_motivo: null,
        plano_expira_em: expiresAt,
        billing_status: "active",
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
      return { ok: false, persisted: false, error: "Empresa não encontrada ou update sem efeito." };
    }

    try {
      await admin.from("assinaturas").upsert(
        {
          empresa_id: id,
          plano: p,
          status: "active",
          ciclo: "manual",
          provider: "manual",
          current_period_start: new Date().toISOString(),
          current_period_end: expiresAt,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "empresa_id" }
      );
    } catch {
      /* espelho best-effort */
    }

    try {
      await admin
        .from("solicitacoes_assinatura")
        .update({
          status: "approved",
          decided_at: new Date().toISOString(),
          decided_by: ctx.auth_id,
        })
        .eq("empresa_id", id)
        .eq("status", "pending");
    } catch {
      /* aprovação pendente best-effort */
    }

    return {
      ok: true,
      persisted: true,
      plan: p,
      expiresAt: data.plano_expira_em,
      blocked: false,
    };
  } catch (e: any) {
    return { ok: false, persisted: false, error: e?.message || "Falha." };
  }
}

export async function trocarMeuPlanoAction(
  plan: PlanId,
  ciclo?: "mensal" | "anual"
) {
  const ctx = await getUserContext();
  const empresaId = String(ctx?.empresa_id || "").trim();
  if (!empresaId || !ctx?.auth_id) {
    return {
      ok: false as const,
      setupRequired: true,
      error: "Cadastre ou vincule uma empresa antes de escolher o plano.",
    };
  }

  const pode =
    !!(ctx as any).isSuperAdmin ||
    !!(ctx as any).isSupervisor ||
    !!(ctx as any).isAdministrador;

  if (!pode) {
    return {
      ok: false as const,
      error: "Somente Administrador, Supervisor ou Superadmin pode solicitar mudança de plano.",
    };
  }

  const p = normalizePlanId(plan);
  const c = ciclo === "anual" ? "anual" : "mensal";

  try {
    const { getSupabaseAdmin } = await import("@/lib/server-db");
    const admin = await getSupabaseAdmin();

    const now = new Date().toISOString();

    const { data: empresa, error: empresaError } = await admin
      .from("empresas")
      .select("id, plano, billing_status")
      .eq("id", empresaId)
      .maybeSingle();

    if (empresaError) return { ok: false as const, error: empresaError.message };
    if (!empresa) return { ok: false as const, error: "Empresa não encontrada." };

    const { data: pendingRequest, error: pendingReadError } = await admin
      .from("solicitacoes_assinatura")
      .select("id")
      .eq("empresa_id", empresaId)
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (pendingReadError) {
      return { ok: false as const, error: pendingReadError.message };
    }

    if (pendingRequest?.id) {
      const { error: requestError } = await admin
        .from("solicitacoes_assinatura")
        .update({
          solicitado_por: ctx.auth_id,
          plano: p,
          ciclo: c,
          observacao: "Solicitação de mudança atualizada pelo painel comercial",
          decided_at: null,
          decided_by: null,
        })
        .eq("id", pendingRequest.id)
        .eq("empresa_id", empresaId);

      if (requestError) {
        return { ok: false as const, error: requestError.message };
      }
    } else {
      const { error: requestError } = await admin
        .from("solicitacoes_assinatura")
        .insert({
          empresa_id: empresaId,
          solicitado_por: ctx.auth_id,
          plano: p,
          ciclo: c,
          status: "pending",
          observacao: "Solicitação de mudança criada pelo painel comercial",
        });

      if (requestError) {
        return { ok: false as const, error: requestError.message };
      }
    }

    try {
      await admin.from("commercial_audit_log").insert({
        empresa_id: empresaId,
        actor_user_id: ctx.auth_id,
        event: "subscription.change_requested",
        payload: {
          current_plan: normalizePlanId((empresa as any).plano || "essencial"),
          requested_plan: p,
          cycle: c,
          billing_status: (empresa as any).billing_status || null,
        },
      });
    } catch {}

    return {
      ok: true as const,
      pending: true,
      requiresOwnerApproval: true,
      plan: p,
      ciclo: c,
    };
  } catch (e: any) {
    return { ok: false as const, error: e?.message || "Falha." };
  }
}

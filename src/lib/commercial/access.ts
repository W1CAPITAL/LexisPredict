"use server";

import { getUserContext, getSupabaseAdmin } from "@/lib/server-db";
import { normalizePlanId, type PlanId } from "@/lib/planos-pacotes";

export type CommercialAccess = {
  ok: boolean;
  authenticated: boolean;
  empresaId: string | null;
  plan: PlanId;
  blocked: boolean;
  expired: boolean;
  expiresAt: string | null;
  role: string | null;
  isSuperAdmin: boolean;
  reason?: string;
};

export async function getCommercialAccess(): Promise<CommercialAccess> {
  const ctx = await getUserContext();
  if (!ctx?.auth_id) {
    return {
      ok: false,
      authenticated: false,
      empresaId: null,
      plan: "essencial",
      blocked: true,
      expired: false,
      expiresAt: null,
      role: null,
      isSuperAdmin: false,
      reason: "unauthenticated",
    };
  }

  if (ctx.isSuperAdmin) {
    return {
      ok: true,
      authenticated: true,
      empresaId: ctx.empresa_id || null,
      plan: "maximo",
      blocked: false,
      expired: false,
      expiresAt: null,
      role: ctx.cargo || "Superadmin",
      isSuperAdmin: true,
    };
  }

  const empresaId = String(ctx.empresa_id || "").trim();
  if (!empresaId) {
    return {
      ok: false,
      authenticated: true,
      empresaId: null,
      plan: "essencial",
      blocked: false,
      expired: false,
      expiresAt: null,
      role: ctx.cargo || null,
      isSuperAdmin: false,
      reason: "tenant_missing",
    };
  }

  const admin = await getSupabaseAdmin();
  const { data, error } = await admin
    .from("empresas")
    .select("id, plano, plano_bloqueado, plano_expira_em, billing_status")
    .eq("id", empresaId)
    .maybeSingle();

  if (error || !data) {
    return {
      ok: false,
      authenticated: true,
      empresaId,
      plan: "essencial",
      blocked: false,
      expired: false,
      expiresAt: null,
      role: ctx.cargo || null,
      isSuperAdmin: false,
      reason: error?.message || "tenant_not_found",
    };
  }

  const expiresAt = data.plano_expira_em || null;
  const expired = !!expiresAt && new Date(expiresAt).getTime() < Date.now();
  const billingStatus = String(data.billing_status || "").trim().toLowerCase();
  const billingActive = billingStatus === "active" || billingStatus === "trialing";
  const billingBlocked = ["past_due", "suspended", "canceled"].includes(billingStatus);
  const blocked = !!data.plano_bloqueado || billingBlocked;
  const pending = !billingActive && !billingBlocked;

  return {
    ok: billingActive && !blocked && !expired,
    authenticated: true,
    empresaId,
    plan: normalizePlanId(data.plano || "essencial"),
    blocked,
    expired,
    expiresAt,
    role: ctx.cargo || null,
    isSuperAdmin: false,
    reason: blocked
      ? "subscription_blocked"
      : expired
        ? "subscription_expired"
        : pending
          ? "subscription_pending"
          : undefined,
  };
}

export async function requireCommercialAccess() {
  const access = await getCommercialAccess();
  if (!access.ok) {
    throw new Error(access.reason || "commercial_access_denied");
  }
  return access;
}

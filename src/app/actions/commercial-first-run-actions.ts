"use server";

import { getSupabaseAdmin, getUserContext } from "@/lib/server-db";

export type FirstRunPreferencesInput = {
  navLayout: "dock" | "vertical";
  sidebarCompact: boolean;
};

export type FirstRunPreferencesResult =
  | {
      ok: true;
      navLayout: FirstRunPreferencesInput["navLayout"];
      sidebarCompact: boolean;
    }
  | {
      ok: false;
      error: string;
    };

export async function completeCommercialFirstRunAction(
  input: FirstRunPreferencesInput
): Promise<FirstRunPreferencesResult> {
  const ctx = await getUserContext();
  const empresaId = String(ctx?.empresa_id || "").trim();

  if (!empresaId) {
    return { ok: false as const, error: "Empresa não vinculada à sessão." };
  }

  const navLayout: FirstRunPreferencesInput["navLayout"] =
    input.navLayout === "vertical" ? "vertical" : "dock";
  const sidebarCompact = !!input.sidebarCompact;
  const admin = await getSupabaseAdmin();

  const { data: empresa, error: readError } = await admin
    .from("empresas")
    .select("id, billing_status, plano_bloqueado")
    .eq("id", empresaId)
    .maybeSingle();

  if (readError) {
    return { ok: false as const, error: readError.message };
  }
  if (!empresa) {
    return { ok: false as const, error: "Empresa não encontrada." };
  }

  const billing = String(empresa.billing_status || "").toLowerCase();
  if (billing !== "active" || empresa.plano_bloqueado) {
    return {
      ok: false as const,
      error: "A configuração inicial fica disponível após a ativação do plano.",
    };
  }

  const { error } = await admin
    .from("empresas")
    .update({
      nav_layout: navLayout,
      sidebar_compact: sidebarCompact,
      onboarding_completed: true,
    })
    .eq("id", empresaId);

  if (error) {
    return { ok: false as const, error: error.message };
  }

  try {
    await admin.from("commercial_audit_log").insert({
      empresa_id: empresaId,
      actor_user_id: ctx.auth_id,
      event: "tenant.first_run_completed",
      payload: {
        nav_layout: navLayout,
        sidebar_compact: sidebarCompact,
      },
    });
  } catch {}

  return {
    ok: true as const,
    navLayout,
    sidebarCompact,
  };
}

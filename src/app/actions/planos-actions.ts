"use server";

import { getUserContext } from "@/lib/server-db";
import { normalizePlanId, type PlanId } from "@/lib/planos-pacotes";
import {valorCiclo} from "@/lib/planos-precos";
import {RENEWAL_TERMS_VERSION} from "@/lib/subscription-renewal";

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

    let data: any = null;
    let error: any = null;
    let legacyCommercialSchema = false;

    const full = await admin
      .from("empresas")
      .select("id, nome, plano, plano_expira_em, plano_bloqueado, plano_bloqueio_motivo, billing_status, plan_self_service_unlocked, onboarding_completed, nav_layout, sidebar_compact")
      .eq("id", empresaId)
      .maybeSingle();

    data = full.data;
    error = full.error;

    if (error && /billing_status|plan_self_service_unlocked|onboarding_completed|nav_layout|sidebar_compact|column .* does not exist/i.test(String(error.message || ""))) {
      legacyCommercialSchema = true;
      const legacy = await admin
        .from("empresas")
        .select("id, nome, plano, plano_expira_em, plano_bloqueado, plano_bloqueio_motivo")
        .eq("id", empresaId)
        .maybeSingle();
      data = legacy.data;
      error = legacy.error;
    }

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

    const normalizedPlan = data.plano ? normalizePlanId(data.plano) : "essencial";
    const billingStatus = legacyCommercialSchema
      ? "active"
      : String(data.billing_status || "").trim().toLowerCase();
    const blockedByBilling = ["past_due", "suspended", "canceled"].includes(billingStatus);

    return {
      ok: true,
      empresaId,
      plan: normalizedPlan,
      expiresAt:
        legacyCommercialSchema && normalizedPlan === "maximo"
          ? null
          : data.plano_expira_em ?? null,
      blocked: !!data.plano_bloqueado || blockedByBilling,
      blockedReason:
        data.plano_bloqueio_motivo ??
        (blockedByBilling ? billingStatus : null),
      billingStatus: legacyCommercialSchema ? "active" : data.billing_status ?? null,
      selfServiceUnlocked: !!data.plan_self_service_unlocked,
      onboardingCompleted: legacyCommercialSchema ? true : !!data.onboarding_completed,
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
  } catch (e: any) {
    throw new Error(e?.message || "Falha ao listar empresas no Supabase.");
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

    const { data, error } = await admin
      .from("empresas")
      .update({ plano: p })
      .eq("id", id)
      .select("id, plano")
      .maybeSingle();

    if (error) {
      return {
        ok: false,
        persisted: false,
        error: error.message,
        plan: p,
        missingColumns: /column .* does not exist/i.test(error.message || ""),
      };
    }

    const persistedPlan = data ? normalizePlanId((data as any).plano || "essencial") : null;
    if (!data || persistedPlan !== p) {
      return {
        ok: false,
        persisted: false,
        error: "O banco não confirmou a alteração do plano.",
        plan: p,
      };
    }

    return { ok: true, persisted: true, plan: persistedPlan };
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

    let data: any = null;
    let error: any = null;

    const fullUpdate = await admin
      .from("empresas")
      .update({
        plano_bloqueado: true,
        plano_bloqueio_motivo: motivo || "inadimplencia",
        billing_status: "suspended",
      })
      .eq("id", id)
      .select("id, plano, plano_bloqueado, billing_status")
      .maybeSingle();

    data = fullUpdate.data;
    error = fullUpdate.error;

    if (error && /billing_status|column .* does not exist/i.test(String(error.message || ""))) {
      const legacyUpdate = await admin
        .from("empresas")
        .update({
          plano_bloqueado: true,
          plano_bloqueio_motivo: motivo || "inadimplencia",
        })
        .eq("id", id)
        .select("id, plano, plano_bloqueado")
        .maybeSingle();
      data = legacyUpdate.data;
      error = legacyUpdate.error;
    }

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

    let data: any = null;
    let error: any = null;
    let legacyCommercialSchema = false;

    const fullUpdate = await admin
      .from("empresas")
      .update({
        plano: p,
        plano_bloqueado: false,
        plano_bloqueio_motivo: null,
        plano_expira_em: expiresAt,
        billing_status: "active",
        onboarding_completed: true,
      })
      .eq("id", id)
      .select("id, plano, plano_bloqueado, plano_bloqueio_motivo, plano_expira_em, billing_status, onboarding_completed")
      .maybeSingle();

    data = fullUpdate.data;
    error = fullUpdate.error;

    if (error && /billing_status|onboarding_completed|column .* does not exist/i.test(String(error.message || ""))) {
      legacyCommercialSchema = true;
      const legacyUpdate = await admin
        .from("empresas")
        .update({
          plano: p,
          plano_bloqueado: false,
          plano_bloqueio_motivo: null,
          plano_expira_em: expiresAt,
        })
        .eq("id", id)
        .select("id, plano, plano_bloqueado, plano_bloqueio_motivo, plano_expira_em")
        .maybeSingle();
      data = legacyUpdate.data;
      error = legacyUpdate.error;
    }

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

    const verifiedPlan = normalizePlanId((data as any).plano || "essencial");
    const verifiedBilling = legacyCommercialSchema
      ? "active"
      : String((data as any).billing_status || "").toLowerCase();
    const verifiedBlocked = !!(data as any).plano_bloqueado;

    if (verifiedPlan !== p || verifiedBilling !== "active" || verifiedBlocked) {
      return {
        ok: false,
        persisted: false,
        error:
          "O banco respondeu ao update, mas a assinatura não ficou ativa. " +
          `plano=${verifiedPlan}, billing=${verifiedBilling || "vazio"}, bloqueado=${verifiedBlocked ? "sim" : "não"}.`,
      };
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
      plan: verifiedPlan,
      expiresAt: data.plano_expira_em,
      blocked: verifiedBlocked,
      billingStatus: verifiedBilling,
      onboardingCompleted: legacyCommercialSchema ? true : !!(data as any).onboarding_completed,
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

    let empresa: any = null;
    let empresaError: any = null;

    const commercialRead = await admin
      .from("empresas")
      .select("id, plano, billing_status")
      .eq("id", empresaId)
      .maybeSingle();

    empresa = commercialRead.data;
    empresaError = commercialRead.error;

    if (empresaError && /billing_status|column .* does not exist/i.test(String(empresaError.message || ""))) {
      const legacyRead = await admin
        .from("empresas")
        .select("id, plano")
        .eq("id", empresaId)
        .maybeSingle();
      empresa = legacyRead.data;
      empresaError = legacyRead.error;
    }

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


/**
 * Registra um pedido de renovação com ciência explícita do termo vigente.
 * Não ativa assinatura, não altera vencimento e não executa cobrança.
 * O histórico e a requisição ficam no servidor, sem confiar no plano enviado pelo navegador.
 */
export async function solicitarRenovacaoAssinaturaAction(input: {
  ciclo: "mensal" | "anual";
  termosVersao: string;
  confirmouTermos: boolean;
}) {
  const ctx = await getUserContext();
  const empresaId = String(ctx?.empresa_id || "").trim();
  if (!ctx?.auth_id || !empresaId) {
    return {ok: false as const, error: "Vincule uma empresa e entre novamente para solicitar a renovação."};
  }
  const autorizado = !!(ctx as any).isSuperAdmin || !!(ctx as any).isSupervisor || !!(ctx as any).isAdministrador;
  if (!autorizado) {
    return {ok: false as const, error: "Somente o responsável autorizado pela empresa pode solicitar renovação."};
  }
  if (!input || !input.confirmouTermos || input.termosVersao !== RENEWAL_TERMS_VERSION) {
    return {ok: false as const, error: "Leia e aceite a versão atual do termo de renovação antes de continuar."};
  }
  if (input.ciclo !== "mensal" && input.ciclo !== "anual") {
    return {ok: false as const, error: "Selecione um ciclo de renovação válido."};
  }
  try {
    const {getSupabaseAdmin} = await import("@/lib/server-db");
    const admin = await getSupabaseAdmin();
    if (!admin) return {ok: false as const, error: "Banco de dados comercial indisponível."};

    const {data: empresa, error: empresaError} = await admin
      .from("empresas")
      .select("id, plano, plano_expira_em")
      .eq("id", empresaId)
      .maybeSingle();
    if (empresaError) return {ok: false as const, error: empresaError.message};
    if (!empresa) return {ok: false as const, error: "Empresa não encontrada."};

    // Nunca sobrescrever pedidos pendentes de upgrade, downgrade ou ativação.
    const {data: pendente, error: pendenteError} = await admin
      .from("solicitacoes_assinatura")
      .select("id")
      .eq("empresa_id", empresaId)
      .eq("status", "pending")
      .limit(1)
      .maybeSingle();
    if (pendenteError) return {ok: false as const, error: pendenteError.message};
    if (pendente) {
      return {ok: false as const, error: "Já existe uma solicitação comercial pendente para esta empresa. Conclua ou cancele o pedido anterior antes de renovar."};
    }

    const plan = normalizePlanId(String(empresa.plano || "essencial"));
    const priceReference = valorCiclo(plan, input.ciclo);
    const observation = "Solicitação de renovação. Termo " + RENEWAL_TERMS_VERSION + ". Sem ativação ou cobrança automática; sujeita à confirmação comercial.";
    const {data: request, error: requestError} = await admin
      .from("solicitacoes_assinatura")
      .insert({
        empresa_id: empresaId,
        solicitado_por: ctx.auth_id,
        plano: plan,
        ciclo: input.ciclo,
        status: "pending",
        observacao: observation,
      })
      .select("id")
      .single();
    if (requestError || !request?.id) {
      return {ok: false as const, error: requestError?.message || "A solicitação não foi salva."};
    }

    const {error: auditError} = await admin
      .from("commercial_audit_log")
      .insert({
        empresa_id: empresaId,
        actor_user_id: ctx.auth_id,
        event: "subscription.renewal_requested",
        payload: {
          request_id: request.id,
          terms_version: RENEWAL_TERMS_VERSION,
          accepted_explicitly: true,
          accepted_at: new Date().toISOString(),
          plan,
          cycle: input.ciclo,
          public_price_reference_brl: priceReference,
          previous_expiration: empresa.plano_expira_em || null,
          billing_activated: false,
          source: "lexispredict_planos",
        },
      });

    if (auditError) {
      // Nunca confirmar um aceite sem trilha de auditoria válida.
      await admin.from("solicitacoes_assinatura").delete().eq("id", request.id).eq("empresa_id", empresaId);
      return {ok: false as const, error: "Não foi possível registrar o aceite auditável. A renovação não foi confirmada."};
    }

    return {
      ok: true as const,
      requestId: String(request.id),
      pending: true,
      plan,
      ciclo: input.ciclo,
      termsVersion: RENEWAL_TERMS_VERSION,
      message: "Solicitação registrada para análise comercial. Não houve cobrança ou renovação automática.",
    };
  } catch (e) {
    return {ok: false as const, error: e instanceof Error ? e.message : "Falha ao solicitar renovação."};
  }
}

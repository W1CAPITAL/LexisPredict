"use server";

import { createHash, randomUUID, timingSafeEqual } from "node:crypto";
import { headers } from "next/headers";
import { getSupabaseAdmin, getUserContext } from "@/lib/server-db";
import { normalizePlanId, type PlanId } from "@/lib/planos-pacotes";
import { publicCommercialSignupEnabled, probeCommercialSignupSchema } from "@/lib/commercial/signup-readiness";

function courtesyTokenHash() {
  // Sem fallback embutido: cortesia só existe quando o proprietário
  // configura explicitamente o hash no ambiente seguro do servidor.
  return String(process.env.LEXIS_COURTESY_TOKEN_SHA256 || "")
    .trim()
    .toLowerCase();
}

function isValidCourtesyToken(raw?: string | null) {
  const token = String(raw || "").trim();
  if (!token) return false;

  const got = createHash("sha256").update(token, "utf8").digest();
  const expectedHex = courtesyTokenHash();
  if (!/^[a-f0-9]{64}$/i.test(expectedHex)) return false;

  const expected = Buffer.from(expectedHex, "hex");
  return got.length === expected.length && timingSafeEqual(got, expected);
}

async function enforceSignupRateLimit(email: string) {
  const admin = await getSupabaseAdmin();
  const h = await headers();
  const forwarded = String(h.get("x-forwarded-for") || "").split(",")[0]?.trim();
  const ip = forwarded || String(h.get("x-real-ip") || "unknown");
  const now = Date.now();
  const since = new Date(now - 60 * 60 * 1000).toISOString();

  const hash = (value: string) =>
    createHash("sha256").update(value, "utf8").digest("hex");

  const checks = [
    { scope: "ip", key: hash(ip), max: 10 },
    { scope: "email", key: hash(email.toLowerCase()), max: 3 },
  ];

  for (const item of checks) {
    const { count, error } = await admin
      .from("commercial_signup_attempts")
      .select("id", { head: true, count: "exact" })
      .eq("scope", item.scope)
      .eq("key_hash", item.key)
      .gte("created_at", since);

    if (error) return { ok: false as const, error: "Não foi possível verificar os limites de cadastro. Tente novamente mais tarde." };
    if (Number(count || 0) >= item.max) {
      return {
        ok: false as const,
        error:
          item.scope === "email"
            ? "Muitas tentativas para este e-mail. Aguarde antes de tentar novamente."
            : "Muitas tentativas de cadastro. Aguarde antes de tentar novamente.",
      };
    }
  }

  try {
    const { error: writeError } = await admin.from("commercial_signup_attempts").insert(
      checks.map((item) => ({
        scope: item.scope,
        key_hash: item.key,
      }))
    );
    if (writeError) return { ok: false as const, error: "Não foi possível registrar os limites de cadastro. Tente novamente mais tarde." };
  } catch {
    return { ok: false as const, error: "Não foi possível registrar os limites de cadastro. Tente novamente mais tarde." };
  }

  return { ok: true as const };
}

async function enforceTokenValidationRateLimit() {
  const admin = await getSupabaseAdmin();
  const h = await headers();
  const forwarded = String(h.get("x-forwarded-for") || "").split(",")[0]?.trim();
  const ip = forwarded || String(h.get("x-real-ip") || "unknown");
  const key = createHash("sha256").update(ip, "utf8").digest("hex");
  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();

  const { count, error } = await admin
    .from("commercial_signup_attempts")
    .select("id", { head: true, count: "exact" })
    .eq("scope", "courtesy_token")
    .eq("key_hash", key)
    .gte("created_at", since);

  if (error) return { ok: false as const, error: "Não foi possível validar o limite de tentativas. Tente novamente mais tarde." };
  if (Number(count || 0) >= 20) {
    return {
      ok: false as const,
      error: "Muitas tentativas de token. Aguarde antes de tentar novamente.",
    };
  }

  try {
    const { error: writeError } = await admin.from("commercial_signup_attempts").insert({
      scope: "courtesy_token",
      key_hash: key,
    });
    if (writeError) return { ok: false as const, error: "Não foi possível registrar a tentativa de validação." };
  } catch {
    return { ok: false as const, error: "Não foi possível registrar a tentativa de validação." };
  }

  return { ok: true as const };
}

export async function validateCourtesyTokenAction(token: string) {
  const rate = await enforceTokenValidationRateLimit();
  if (!rate.ok) return { ok: false, valid: false, error: rate.error };
  return { ok: true, valid: isValidCourtesyToken(token) };
}

export type CommercialSignupInput = {
  empresa: string;
  email: string;
  password: string;
  nome?: string;
  plan?: PlanId;
  courtesyToken?: string;
  termosVersao: string;
  termosAceitosEm: string;
};

export async function createCommercialAccountAction(input: CommercialSignupInput) {
  // Pilot onboarding remains assisted until verified e-mail, schema, RLS,
  // entitlement and payment acceptance tests are completed.
  if (!publicCommercialSignupEnabled(process.env.LEXIS_COMMERCIAL_SIGNUP_ENABLED)) {
    return {
      ok: false as const,
      code: "signup_paused",
      error: "Novos cadastros estão temporariamente em implantação assistida. Solicite acesso à equipe W1 Capital.",
    };
  }

  const empresaNome = String(input.empresa || "").trim();
  const email = String(input.email || "").trim().toLowerCase();
  const password = String(input.password || "");
  const nome = String(input.nome || email.split("@")[0] || "ADMINISTRADOR").trim();
  const requestedPlan = normalizePlanId(input.plan || "essencial");
  const rawCourtesyToken = String(input.courtesyToken || "").trim();

  if (!empresaNome) return { ok: false as const, error: "Informe o nome da empresa." };
  if (!email || !email.includes("@")) return { ok: false as const, error: "Informe um e-mail válido." };
  if (password.length < 6) return { ok: false as const, error: "A senha precisa ter pelo menos 6 caracteres." };

  const rate = await enforceSignupRateLimit(email);
  if (!rate.ok) return rate;

  const courtesy = isValidCourtesyToken(rawCourtesyToken);
  if (rawCourtesyToken && !courtesy) {
    return { ok: false as const, code: "invalid_token", error: "Token de liberação inválido." };
  }

  const admin = await getSupabaseAdmin();
  const readiness = await probeCommercialSignupSchema(admin);
  if (!readiness.ok) {
    // Fail BEFORE creating an Auth user; do not expose schema details to clients.
    return {
      ok: false as const,
      code: "commercial_schema_not_ready",
      error: "O cadastro comercial está em manutenção. Solicite implantação assistida à equipe W1.",
    };
  }
  const empresaId = randomUUID();

  const userMetadata = {
    full_name: nome.toUpperCase(),
    empresa_nome: empresaNome.toUpperCase(),
    plano_solicitado: requestedPlan,
    lexis_signup: "commercial",
    termos_versao: String(input.termosVersao || "2026-09-21"),
    termos_aceitos_em: String(input.termosAceitosEm || new Date().toISOString()),
    consentimento_dados: true,
    consentimento_ia_revisao_humana: true,
  };

  // Duplicate e-mail or interrupted signup must NEVER reset another
  // user's password. Owner verification is handled by Supabase recovery or
  // an authorized administrator; public signup cannot claim an orphan.
  const { data: createdAuth, error: authError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: false, // Never mark an arbitrary submitted address as verified.
    user_metadata: userMetadata,
    app_metadata: { lexis_commercial: true },
  });
  if (authError || !createdAuth.user) {
    return {
      ok: false as const,
      code: "signup_requires_review",
      error: "Não foi possível iniciar o cadastro. Se já existir uma conta, faça login ou recupere o acesso pelo fluxo oficial.",
    };
  }
  const authUserId = createdAuth.user.id;

  const effectivePlan = courtesy ? requestedPlan : "essencial";
  const billingStatus = courtesy ? "active" : "pending";

  const rollback = async () => {
    try {
      await admin.from("usuarios").delete().eq("auth_user_id", authUserId);
    } catch {}
    try {
      await admin.from("empresas").delete().eq("id", empresaId);
    } catch {}
    try {
      await admin.auth.admin.deleteUser(authUserId);
    } catch {}
  };

  const { error: empresaError } = await admin.from("empresas").insert({
    id: empresaId,
    nome: empresaNome.toUpperCase(),
    plano: effectivePlan,
    ativo: true,
    plano_bloqueado: false,
    plano_bloqueio_motivo: null,
    plano_expira_em: null,
    billing_status: billingStatus,
    plan_self_service_unlocked: false,
    onboarding_completed: false,
    nav_layout: "dock",
    sidebar_compact: false,
  });

  if (empresaError) {
    await rollback();
    return { ok: false as const, error: empresaError.message };
  }

  const { error: profileError } = await admin.from("usuarios").insert({
    id: randomUUID(),
    auth_user_id: authUserId,
    empresa_id: empresaId,
    nome: nome.toUpperCase(),
    email,
    cargo: "Administrador",
    role: "admin",
  });

  if (profileError) {
    await rollback();
    return { ok: false as const, error: profileError.message };
  }

  const now = new Date().toISOString();

  if (courtesy) {
    const { error: assinaturaError } = await admin.from("assinaturas").upsert(
      {
        empresa_id: empresaId,
        plano: requestedPlan,
        status: "active",
        ciclo: "cortesia",
        provider: "courtesy_token",
        current_period_start: now,
        current_period_end: null,
        updated_at: now,
      },
      { onConflict: "empresa_id" }
    );

    if (assinaturaError) {
      await rollback();
      return { ok: false as const, error: assinaturaError.message };
    }

    try {
      await admin.from("solicitacoes_assinatura").insert({
        empresa_id: empresaId,
        solicitado_por: authUserId,
        plano: requestedPlan,
        ciclo: "cortesia",
        status: "approved",
        observacao: "Plano liberado por token de cortesia",
        decided_at: now,
        decided_by: authUserId,
      });
    } catch {}
  } else {
    try {
      await admin.from("assinaturas").upsert(
        {
          empresa_id: empresaId,
          plano: "essencial",
          status: "pending",
          ciclo: "mensal",
          provider: "manual",
          current_period_start: now,
          current_period_end: null,
          updated_at: now,
        },
        { onConflict: "empresa_id" }
      );
    } catch {}

    try {
      await admin.from("solicitacoes_assinatura").insert({
        empresa_id: empresaId,
        solicitado_por: authUserId,
        plano: requestedPlan,
        ciclo: "mensal",
        status: "pending",
        observacao: "Solicitação inicial criada pelo cadastro comercial",
      });
    } catch {}
  }

  try {
    await admin.from("commercial_audit_log").insert({
      empresa_id: empresaId,
      actor_user_id: authUserId,
      event: courtesy ? "subscription.courtesy_token_activated" : "tenant.signup_created",
      payload: {
        requested_plan: requestedPlan,
        auth_recovered: false,
        effective_plan: effectivePlan,
        billing_status: billingStatus,
        terms_version: String(input.termosVersao || "2026-09-21"),
      },
    });
  } catch {}

  return {
    ok: true as const,
    empresaId,
    plan: effectivePlan,
    requestedPlan,
    courtesy,
    billingStatus,
    recoveredAuth: false,
  };
}

export async function activateCourtesyPlanAction(token: string, plan: PlanId) {
  const ctx = await getUserContext();
  if (!ctx?.empresa_id || !ctx?.auth_id) {
    return { ok: false as const, error: "Sessão empresarial não encontrada." };
  }

  if (!isValidCourtesyToken(token)) {
    return { ok: false as const, error: "Token inválido." };
  }

  const selectedPlan = normalizePlanId(plan);
  const admin = await getSupabaseAdmin();
  const now = new Date().toISOString();

  const { data: empresa, error: empresaError } = await admin
    .from("empresas")
    .update({
      plano: selectedPlan,
      plano_bloqueado: false,
      plano_bloqueio_motivo: null,
      plano_expira_em: null,
      billing_status: "active",
      plan_self_service_unlocked: false,
    })
    .eq("id", ctx.empresa_id)
    .select("id")
    .maybeSingle();

  if (empresaError || !empresa) {
    return {
      ok: false as const,
      error: empresaError?.message || "Empresa não encontrada.",
    };
  }

  const { error: assinaturaError } = await admin.from("assinaturas").upsert(
    {
      empresa_id: ctx.empresa_id,
      plano: selectedPlan,
      status: "active",
      ciclo: "cortesia",
      provider: "courtesy_token",
      current_period_start: now,
      current_period_end: null,
      updated_at: now,
    },
    { onConflict: "empresa_id" }
  );

  if (assinaturaError) {
    return { ok: false as const, error: assinaturaError.message };
  }

  try {
    await admin
      .from("solicitacoes_assinatura")
      .update({
        status: "approved",
        decided_at: now,
        decided_by: ctx.auth_id,
      })
      .eq("empresa_id", ctx.empresa_id)
      .eq("status", "pending");
  } catch {}

  try {
    await admin.from("commercial_audit_log").insert({
      empresa_id: ctx.empresa_id,
      actor_user_id: ctx.auth_id,
      event: "subscription.courtesy_token_activated",
      payload: { plan: selectedPlan },
    });
  } catch {}

  return { ok: true as const, plan: selectedPlan };
}

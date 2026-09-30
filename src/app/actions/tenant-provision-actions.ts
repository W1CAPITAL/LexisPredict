"use server";

import { randomUUID } from "node:crypto";
import { createClient as createRequestClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/server-db";
import { normalizePlanId, type PlanId } from "@/lib/planos-pacotes";

export type ProvisionEmpresaInput = {
  empresa: string;
  nome?: string;
  plan?: PlanId;
};

export type ProvisionEmpresaResult = {
  ok: boolean;
  empresaId?: string;
  created?: boolean;
  alreadyReady?: boolean;
  error?: string;
};

export async function provisionMinhaEmpresaAction(
  input: ProvisionEmpresaInput
): Promise<ProvisionEmpresaResult> {
  try {
    const requestClient = await createRequestClient();
    if (!requestClient) return { ok: false, error: "Supabase não configurado." };

    const {
      data: { user },
      error: authError,
    } = await requestClient.auth.getUser();

    if (authError || !user) {
      return { ok: false, error: "Sessão não encontrada. Entre novamente." };
    }

    const admin = await getSupabaseAdmin();
    if (!admin) return { ok: false, error: "Cliente administrativo indisponível." };

    const empresaNome = String(
      input.empresa ||
      user.user_metadata?.empresa_nome ||
      ""
    ).trim();

    if (!empresaNome) {
      return { ok: false, error: "Informe o nome da empresa." };
    }

    const nomeUsuario = String(
      input.nome ||
      user.user_metadata?.full_name ||
      user.email?.split("@")[0] ||
      "ADMINISTRADOR"
    ).trim();

    const requestedPlan = normalizePlanId(
      input.plan ||
      user.user_metadata?.plano_solicitado ||
      "essencial"
    );

    const { data: existingProfile, error: profileReadError } = await admin
      .from("usuarios")
      .select("id, empresa_id, nome, email, cargo")
      .eq("auth_user_id", user.id)
      .maybeSingle();

    if (profileReadError) {
      return { ok: false, error: profileReadError.message };
    }

    if (existingProfile?.empresa_id) {
      const empresaId = String(existingProfile.empresa_id);
      const { data: existingCompany, error: companyReadError } = await admin
        .from("empresas")
        .select("id")
        .eq("id", empresaId)
        .maybeSingle();

      if (companyReadError) {
        return { ok: false, error: companyReadError.message };
      }

      if (existingCompany?.id) {
        return {
          ok: true,
          empresaId,
          created: false,
          alreadyReady: true,
        };
      }

      const { error: recreateError } = await admin.from("empresas").insert({
        id: empresaId,
        nome: empresaNome.toUpperCase(),
        plano: "essencial",
        ativo: true,
        plano_bloqueado: false,
        plano_bloqueio_motivo: null,
        billing_status: "pending",
      });

      if (recreateError) {
        return { ok: false, error: recreateError.message };
      }

      return {
        ok: true,
        empresaId,
        created: true,
      };
    }

    const empresaId = randomUUID();
    const usuarioId = existingProfile?.id ? String(existingProfile.id) : randomUUID();

    const { error: empresaError } = await admin.from("empresas").insert({
      id: empresaId,
      nome: empresaNome.toUpperCase(),
      plano: "essencial",
      ativo: true,
      plano_bloqueado: false,
      plano_bloqueio_motivo: null,
      billing_status: "pending",
    });

    if (empresaError) {
      return { ok: false, error: empresaError.message };
    }

    if (existingProfile?.id) {
      const { error: profileUpdateError } = await admin
        .from("usuarios")
        .update({
          empresa_id: empresaId,
          nome: nomeUsuario.toUpperCase(),
          email: String(user.email || existingProfile.email || "").toLowerCase(),
          cargo: existingProfile.cargo || "Administrador",
          role: "admin",
        })
        .eq("id", existingProfile.id);

      if (profileUpdateError) {
        await admin.from("empresas").delete().eq("id", empresaId);
        return { ok: false, error: profileUpdateError.message };
      }
    } else {
      const { error: profileInsertError } = await admin.from("usuarios").insert({
        id: usuarioId,
        auth_user_id: user.id,
        empresa_id: empresaId,
        nome: nomeUsuario.toUpperCase(),
        email: String(user.email || "").toLowerCase(),
        cargo: "Administrador",
        role: "admin",
      });

      if (profileInsertError) {
        await admin.from("empresas").delete().eq("id", empresaId);
        return { ok: false, error: profileInsertError.message };
      }
    }

    try {
      await admin.from("solicitacoes_assinatura").insert({
        empresa_id: empresaId,
        solicitado_por: user.id,
        plano: requestedPlan,
        ciclo: "mensal",
        status: "pending",
        observacao: "Solicitação inicial criada pelo onboarding do tenant",
      });
    } catch {
      /* solicitação é best-effort */
    }

    try {
      await admin.from("assinaturas").upsert(
        {
          empresa_id: empresaId,
          plano: "essencial",
          status: "pending",
          ciclo: "mensal",
          provider: "manual",
          updated_at: new Date().toISOString(),
        },
        { onConflict: "empresa_id" }
      );
    } catch {
      /* espelho de assinatura é best-effort */
    }

    try {
      await admin.from("commercial_audit_log").insert({
        empresa_id: empresaId,
        actor_user_id: user.id,
        event: "tenant.provisioned",
        payload: {
          requested_plan: requestedPlan,
          source: "app_onboarding",
        },
      });
    } catch {
      /* auditoria best-effort */
    }

    return {
      ok: true,
      empresaId,
      created: true,
    };
  } catch (e: any) {
    return {
      ok: false,
      error: e?.message || "Falha ao provisionar a empresa.",
    };
  }
}

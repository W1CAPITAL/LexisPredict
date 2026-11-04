/**
 * Commercial onboarding gates: never provision an Auth identity until the
 * server and the LIVE database are ready for safe multi-tenant signup.
 *
 * These probes only inspect database schema, using HEAD queries with
 * LIMIT 0. No customer records are returned or changed.
 */
export const REQUIRED_COMMERCIAL_RELATIONS = [
  { table: "empresas", fields: "id,nome,plano,billing_status,plan_self_service_unlocked,onboarding_completed,nav_layout,sidebar_compact" },
  { table: "usuarios", fields: "id,empresa_id,auth_user_id,cargo,role" },
  { table: "assinaturas", fields: "id,empresa_id,plano,status,ciclo,provider" },
  { table: "solicitacoes_assinatura", fields: "id,empresa_id,solicitado_por,plano,ciclo,status" },
  { table: "commercial_audit_log", fields: "id,empresa_id,actor_user_id,event,payload" },
  { table: "commercial_signup_attempts", fields: "id,scope,key_hash,created_at" },
] as const;

/**
 * Fail closed by default. Do NOT enable just because these table probes pass:
 * require verified-email onboarding, tenant isolation, revocation, payment/
 * activation and security-advisor gates to pass independently first.
 */
export function publicCommercialSignupEnabled(flag?: string): boolean {
  return flag === "true";
}

type ProbeClient = {
  from: (table: string) => {
    select: (fields: string, opts: { head: true }) => {
      limit: (count: number) => PromiseLike<{ error: { message?: string } | null }>;
    };
  };
};

export async function probeCommercialSignupSchema(client: ProbeClient): Promise<{ ok: boolean; missing: string[] }> {
  const missing: string[] = [];
  for (const { table, fields } of REQUIRED_COMMERCIAL_RELATIONS) {
    try {
      // PostgREST HEAD suppresses all response rows; LIMIT 0 is defensive.
      const { error } = await client.from(table).select(fields, { head: true }).limit(0);
      if (error) missing.push(table);
    } catch {
      missing.push(table);
    }
  }
  return { ok: missing.length === 0, missing };
}

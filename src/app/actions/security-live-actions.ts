"use server";

import { headers, cookies } from "next/headers";
import {
  runLiveSecurityProbe,
  type LiveProbeReport,
} from "@/lib/security-live-probe";

async function assertSuperadmin(): Promise<
  | { ok: true; empresa_id?: string | null }
  | { ok: false; error: string }
> {
  try {
    const { getUserContext } = await import("@/lib/server-db");
    const ctx = await getUserContext();
    const cargo = String((ctx as any)?.cargo || "");
    const isSuper =
      !!(ctx as any)?.isSuperAdmin ||
      cargo === "Superadmin" ||
      cargo.toLowerCase() === "superadmin";
    if (!isSuper) {
      return {
        ok: false,
        error: "Somente Superadmin pode executar a sonda ao vivo.",
      };
    }
    return { ok: true, empresa_id: (ctx as any)?.empresa_id || null };
  } catch (e: any) {
    return { ok: false, error: e?.message || "Sessão inválida." };
  }
}

/**
 * Sonda FORTE: anônimo + IDOR com cookie da sessão Superadmin.
 * Só ataca o próprio origin.
 */
export async function runLiveIntrusionProbeAction(
  targetBaseUrl?: string
): Promise<
  { success: true; report: LiveProbeReport } | { success: false; error: string }
> {
  const gate = await assertSuperadmin();
  if (!gate.ok) return { success: false, error: gate.error };

  const h = await headers();
  const host = h.get("x-forwarded-host") || h.get("host");
  const proto = h.get("x-forwarded-proto") || "https";
  const fromRequest = host ? `${proto}://${host}` : "";

  let base =
    (targetBaseUrl || "").trim() ||
    process.env.NEXT_PUBLIC_APP_URL ||
    "";
  if (!base && process.env.VERCEL_URL) {
    base = `https://${process.env.VERCEL_URL}`;
  }
  if (!base) base = fromRequest;

  if (!base) {
    return {
      success: false,
      error: "Não foi possível determinar a URL base do app.",
    };
  }

  try {
    const u = new URL(base.startsWith("http") ? base : `https://${base}`);
    const reqHost = host ? host.split(":")[0] : "";
    const allowed =
      u.hostname.endsWith(".vercel.app") ||
      u.hostname === "localhost" ||
      u.hostname === "127.0.0.1" ||
      (process.env.NEXT_PUBLIC_APP_URL &&
        u.hostname === new URL(process.env.NEXT_PUBLIC_APP_URL).hostname) ||
      (reqHost && u.hostname === reqHost);

    if (!allowed && process.env.NODE_ENV === "production") {
      return { success: false, error: "Alvo fora do origin permitido." };
    }

    // Cookie da sessão atual → testes IDOR autenticados
    let sessionCookie: string | null = null;
    try {
      const jar = await cookies();
      const parts: string[] = [];
      for (const c of jar.getAll()) {
        // só cookies de auth / supabase
        if (
          /sb-|supabase|auth|session|token/i.test(c.name) ||
          c.name.startsWith("sb")
        ) {
          parts.push(`${c.name}=${c.value}`);
        }
      }
      if (parts.length) sessionCookie = parts.join("; ");
    } catch {
      sessionCookie = null;
    }

    const report = await runLiveSecurityProbe(u.origin, {
      sessionCookie,
      ownEmpresaId: gate.empresa_id,
    });
    return { success: true, report };
  } catch (e: any) {
    return { success: false, error: String(e?.message || e) };
  }
}

"use server";

import { headers } from "next/headers";
import { runLiveSecurityProbe, type LiveProbeReport } from "@/lib/security-live-probe";

async function assertSuperadmin(): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const { getUserContext } = await import("@/lib/server-db");
    const ctx = await getUserContext();
    const isSuper = !!(ctx as any)?.isSuperAdmin || String((ctx as any)?.cargo || "") === "Superadmin";
    if (!isSuper) {
      return { ok: false, error: "Somente Superadmin pode executar a sonda ao vivo." };
    }
    return { ok: true };
  } catch (e: any) {
    // fallback: cookie role is not enough alone; require context
    return { ok: false, error: e?.message || "Sessão inválida." };
  }
}

/**
 * Sonda ativa: ataca só o próprio origin do request (ou BASE_URL).
 */
export async function runLiveIntrusionProbeAction(targetBaseUrl?: string): Promise<
  | { success: true; report: LiveProbeReport }
  | { success: false; error: string }
> {
  const gate = await assertSuperadmin();
  if (!gate.ok) return { success: false, error: gate.error };

  const h = await headers();
  const host = h.get("x-forwarded-host") || h.get("host");
  const proto = h.get("x-forwarded-proto") || "https";
  const fromRequest = host ? `${proto}://${host}` : "";
  const base =
    (targetBaseUrl || "").trim() ||
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : fromRequest;

  if (!base) {
    return { success: false, error: "Não foi possível determinar a URL base do app." };
  }

  // Só permite o próprio host (anti SSRF / anti abuso)
  try {
    const u = new URL(base.startsWith("http") ? base : `https://${base}`);
    const allowed =
      u.hostname.endsWith(".vercel.app") ||
      u.hostname === "localhost" ||
      u.hostname.endsWith("assecom.vercel.app") ||
      (process.env.NEXT_PUBLIC_APP_URL &&
        u.hostname === new URL(process.env.NEXT_PUBLIC_APP_URL).hostname);
    if (!allowed && process.env.NODE_ENV === "production") {
      // still allow same host as request
      if (host && u.hostname !== host.split(":")[0]) {
        return { success: false, error: "Alvo fora do origin permitido." };
      }
    }
    const report = await runLiveSecurityProbe(u.origin);
    return { success: true, report };
  } catch (e: any) {
    return { success: false, error: String(e?.message || e) };
  }
}

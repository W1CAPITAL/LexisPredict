/**
 * Assinatura: validade, bloqueio e contato do proprietário.
 * Superadmin nunca é bloqueado.
 */

import type { PlanId } from "@/lib/planos-pacotes";
import { normalizePlanId } from "@/lib/planos-pacotes";

/** WhatsApp do proprietário (liberação / suporte comercial). */
export const PROPRIETARIO_WHATSAPP = "13991199349";
export const PROPRIETARIO_LABEL = "Proprietário do LexisPredict";

export const PLAN_DIAS_PADRAO = {
  mensal: 30,
  anual: 365,
} as const;

export type AssinaturaStatus = {
  plan: PlanId;
  expiresAt: string | null;
  blocked: boolean;
  blockedReason?: string;
  origem?: string;
};

const KEY = "lexis_empresa_assinaturas_v1";
const EVT = "lexis-empresa-assinaturas";

export function loadAssinaturas(): Record<string, AssinaturaStatus> {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem(KEY) || "{}") as Record<string, AssinaturaStatus>;
  } catch {
    return {};
  }
}

export function saveAssinatura(empresaId: string, data: AssinaturaStatus) {
  if (typeof window === "undefined" || !empresaId) return;
  const map = loadAssinaturas();
  map[empresaId] = {
    ...data,
    plan: normalizePlanId(data.plan),
  };
  localStorage.setItem(KEY, JSON.stringify(map));
  window.dispatchEvent(new CustomEvent(EVT, { detail: { empresaId, data: map[empresaId] } }));
}

export function getAssinatura(
  empresaId?: string | null,
  fallback: AssinaturaStatus = {
    plan: "maximo",
    expiresAt: null,
    blocked: false,
  }
): AssinaturaStatus {
  if (!empresaId) return fallback;
  const map = loadAssinaturas();
  return map[empresaId] || fallback;
}

export function subscribeAssinaturas(cb: () => void) {
  if (typeof window === "undefined") return () => {};
  const fn = () => cb();
  window.addEventListener(EVT, fn);
  window.addEventListener("storage", fn);
  return () => {
    window.removeEventListener(EVT, fn);
    window.removeEventListener("storage", fn);
  };
}

export function addDaysIso(days: number, from = new Date()): string {
  const d = new Date(from);
  d.setHours(23, 59, 59, 999);
  d.setDate(d.getDate() + Math.max(1, days));
  return d.toISOString();
}

export function daysLeft(expiresAt: string | null | undefined): number | null {
  if (!expiresAt) return null;
  const end = new Date(expiresAt).getTime();
  if (Number.isNaN(end)) return null;
  const ms = end - Date.now();
  return Math.ceil(ms / (24 * 60 * 60 * 1000));
}

export function isExpired(expiresAt: string | null | undefined): boolean {
  if (!expiresAt) return false;
  const end = new Date(expiresAt).getTime();
  if (Number.isNaN(end)) return false;
  return Date.now() > end;
}

export function formatExpira(expiresAt: string | null | undefined): string {
  if (!expiresAt) return "Sem data de término";
  try {
    return new Date(expiresAt).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return String(expiresAt);
  }
}

export function whatsappProprietarioUrl(text?: string): string {
  const msg =
    text ||
    "Olá, sou cliente LexisPredict e preciso liberar/renovar o plano da minha empresa.";
  return `https://wa.me/55${PROPRIETARIO_WHATSAPP}?text=${encodeURIComponent(msg)}`;
}

export const ROTAS_SEM_PLANO = [
  "/login",
  "/signup",
  "/termos",
  "/settings",
];

export function rotaPermitidaSemPlano(pathname: string): boolean {
  const p = pathname || "/";
  return ROTAS_SEM_PLANO.some((r) => p === r || p.startsWith(r + "/"));
}

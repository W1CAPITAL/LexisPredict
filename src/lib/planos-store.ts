import {
  type PlanId,
  normalizePlanId,
} from "@/lib/planos-pacotes";
import {
  getAssinatura,
  saveAssinatura,
  type AssinaturaStatus,
} from "@/lib/planos-assinatura";

const KEY = "lexis_empresa_planos_v1";
const EVT = "lexis-empresa-planos";

export type EmpresaPlanoMap = Record<string, PlanId>;

export function loadEmpresaPlanos(): EmpresaPlanoMap {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, string>;
    const out: EmpresaPlanoMap = {};
    for (const [id, v] of Object.entries(parsed || {})) {
      if (id) out[id] = normalizePlanId(v);
    }
    return out;
  } catch {
    return {};
  }
}

export function planoDaEmpresa(empresaId?: string | null, fallback: PlanId = "maximo"): PlanId {
  if (!empresaId) return fallback;
  const ass = getAssinatura(empresaId);
  if (ass?.plan) return normalizePlanId(ass.plan);
  const map = loadEmpresaPlanos();
  return map[empresaId] || fallback;
}

export function savePlanoEmpresa(empresaId: string, plan: PlanId, extra?: Partial<AssinaturaStatus>) {
  if (typeof window === "undefined" || !empresaId) return;
  const map = loadEmpresaPlanos();
  map[empresaId] = plan;
  localStorage.setItem(KEY, JSON.stringify(map));
  const prev = getAssinatura(empresaId);
  saveAssinatura(empresaId, {
    plan,
    expiresAt: extra?.expiresAt !== undefined ? extra.expiresAt : prev.expiresAt,
    blocked: extra?.blocked !== undefined ? extra.blocked : prev.blocked,
    blockedReason: extra?.blockedReason ?? prev.blockedReason,
    origem: extra?.origem ?? prev.origem,
  });
  window.dispatchEvent(new CustomEvent(EVT, { detail: { empresaId, plan, map } }));
}

export function subscribeEmpresaPlanos(cb: () => void) {
  if (typeof window === "undefined") return () => {};
  const fn = () => cb();
  window.addEventListener(EVT, fn);
  window.addEventListener("storage", fn);
  window.addEventListener("lexis-empresa-assinaturas", fn);
  return () => {
    window.removeEventListener(EVT, fn);
    window.removeEventListener("storage", fn);
    window.removeEventListener("lexis-empresa-assinaturas", fn);
  };
}

import {
  type PlanId,
  normalizePlanId,
} from "@/lib/planos-pacotes";

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
  const map = loadEmpresaPlanos();
  return map[empresaId] || fallback;
}

export function savePlanoEmpresa(empresaId: string, plan: PlanId) {
  if (typeof window === "undefined" || !empresaId) return;
  const map = loadEmpresaPlanos();
  map[empresaId] = plan;
  localStorage.setItem(KEY, JSON.stringify(map));
  window.dispatchEvent(new CustomEvent(EVT, { detail: { empresaId, plan, map } }));
}

export function subscribeEmpresaPlanos(cb: () => void) {
  if (typeof window === "undefined") return () => {};
  const fn = () => cb();
  window.addEventListener(EVT, fn);
  window.addEventListener("storage", fn);
  return () => {
    window.removeEventListener(EVT, fn);
    window.removeEventListener("storage", fn);
  };
}

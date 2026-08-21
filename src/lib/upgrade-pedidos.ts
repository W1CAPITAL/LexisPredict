/**
 * Registro local de pedidos de upgrade (até haver webhook Pix).
 * Superadmin confirma e libera o plano.
 */

import type { PlanId } from "@/lib/planos-pacotes";

export type UpgradePedido = {
  id: string;
  empresaId: string;
  empresaNome?: string;
  plan: PlanId;
  ciclo: "mensal" | "anual";
  valor: number;
  pixPayload: string;
  status: "aguardando_pix" | "pago_confirmado" | "cancelado";
  createdAt: string;
  confirmedAt?: string;
};

const KEY = "lexis_upgrade_pedidos_v1";

function uid() {
  return `up_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

export function loadPedidos(): UpgradePedido[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(KEY) || "[]") as UpgradePedido[];
  } catch {
    return [];
  }
}

export function savePedidos(list: UpgradePedido[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(list.slice(0, 200)));
}

export function criarPedido(
  partial: Omit<UpgradePedido, "id" | "status" | "createdAt">
): UpgradePedido {
  const p: UpgradePedido = {
    ...partial,
    id: uid(),
    status: "aguardando_pix",
    createdAt: new Date().toISOString(),
  };
  const list = loadPedidos();
  list.unshift(p);
  savePedidos(list);
  return p;
}

export function confirmarPedidoPago(id: string): UpgradePedido | null {
  const list = loadPedidos();
  const i = list.findIndex((x) => x.id === id);
  if (i < 0) return null;
  list[i] = {
    ...list[i],
    status: "pago_confirmado",
    confirmedAt: new Date().toISOString(),
  };
  savePedidos(list);
  return list[i];
}

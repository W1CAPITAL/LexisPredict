/**
 * Pedidos de upgrade (local até haver webhook do banco).
 *
 * Fluxo honesto:
 * 1) Gera Pix com referência única (id do pedido)
 * 2) "Informei o pagamento" → aguardando_confirmacao (NÃO libera plano)
 * 3) Só Superadmin "Confirmar no extrato" → pago_confirmado + salvarPlanoEmpresaAction
 */

import type { PlanId } from "@/lib/planos-pacotes";

export type UpgradeStatus =
  | "aguardando_pix"
  | "aguardando_confirmacao"
  | "pago_confirmado"
  | "cancelado"
  | "recusado";

export type UpgradePedido = {
  id: string;
  /** Código curto para achar no extrato / descrição Pix */
  ref: string;
  empresaId: string;
  empresaNome?: string;
  plan: PlanId;
  ciclo: "mensal" | "anual";
  valor: number;
  pixPayload: string;
  status: UpgradeStatus;
  createdAt: string;
  informedAt?: string;
  confirmedAt?: string;
  confirmedBy?: string;
  note?: string;
};

const KEY = "lexis_upgrade_pedidos_v2";

function uid() {
  return `up_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

function refCode() {
  // 8 chars legíveis no extrato
  return `W1${Date.now().toString(36).slice(-4)}${Math.random().toString(36).slice(2, 5)}`.toUpperCase();
}

export function loadPedidos(): UpgradePedido[] {
  if (typeof window === "undefined") return [];
  try {
    const v2 = JSON.parse(localStorage.getItem(KEY) || "[]") as UpgradePedido[];
    if (Array.isArray(v2) && v2.length) return v2;
    // migra v1 se existir
    const v1 = JSON.parse(localStorage.getItem("lexis_upgrade_pedidos_v1") || "[]") as any[];
    return (v1 || []).map((p) => ({
      ...p,
      ref: p.ref || String(p.id || "").slice(-8).toUpperCase(),
      status: p.status === "pago_confirmado" ? "pago_confirmado" : p.status || "aguardando_pix",
    }));
  } catch {
    return [];
  }
}

export function savePedidos(list: UpgradePedido[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(list.slice(0, 200)));
}

export function criarPedido(
  partial: Omit<UpgradePedido, "id" | "ref" | "status" | "createdAt">
): UpgradePedido {
  const p: UpgradePedido = {
    ...partial,
    id: uid(),
    ref: refCode(),
    status: "aguardando_pix",
    createdAt: new Date().toISOString(),
  };
  const list = loadPedidos();
  list.unshift(p);
  savePedidos(list);
  return p;
}

/** Cliente diz que pagou — NÃO libera plano. */
export function marcarPagamentoInformado(id: string, note?: string): UpgradePedido | null {
  const list = loadPedidos();
  const i = list.findIndex((x) => x.id === id);
  if (i < 0) return null;
  list[i] = {
    ...list[i],
    status: "aguardando_confirmacao",
    informedAt: new Date().toISOString(),
    note: note || list[i].note,
  };
  savePedidos(list);
  return list[i];
}

/** Só após ver crédito no extrato (Superadmin). */
export function confirmarPedidoPago(
  id: string,
  confirmedBy?: string
): UpgradePedido | null {
  const list = loadPedidos();
  const i = list.findIndex((x) => x.id === id);
  if (i < 0) return null;
  list[i] = {
    ...list[i],
    status: "pago_confirmado",
    confirmedAt: new Date().toISOString(),
    confirmedBy: confirmedBy || "superadmin",
  };
  savePedidos(list);
  return list[i];
}

export function recusarPedido(id: string, note?: string): UpgradePedido | null {
  const list = loadPedidos();
  const i = list.findIndex((x) => x.id === id);
  if (i < 0) return null;
  list[i] = {
    ...list[i],
    status: "recusado",
    note: note || list[i].note,
  };
  savePedidos(list);
  return list[i];
}

export function statusLabel(s: UpgradeStatus): string {
  switch (s) {
    case "aguardando_pix":
      return "Aguardando Pix";
    case "aguardando_confirmacao":
      return "Aguardando conferência no extrato";
    case "pago_confirmado":
      return "Pago e liberado";
    case "cancelado":
      return "Cancelado";
    case "recusado":
      return "Recusado (sem crédito)";
    default:
      return s;
  }
}

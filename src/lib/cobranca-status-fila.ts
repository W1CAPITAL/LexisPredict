/**
 * Badge de cobrança no card da Fila.
 */

export type StatusCobrancaFila = "em_dia" | "atrasado" | "critico" | "acordo" | "pago_hoje" | "sem_titulo";

export type TituloResumo = {
  status: string;
  diaRelativo?: number;
  valor?: number;
  emAcordo?: boolean;
};

export function statusCobrancaCliente(titulos: TituloResumo[]): {
  status: StatusCobrancaFila;
  label: string;
  className: string;
  valorAberto: number;
} {
  if (!titulos.length) {
    return { status: "sem_titulo", label: "Sem título", className: "bg-secondary text-muted-foreground", valorAberto: 0 };
  }
  const abertos = titulos.filter((t) => t.status !== "pago" && t.status !== "cancelado");
  if (!abertos.length) {
    return { status: "pago_hoje", label: "Quitado", className: "bg-emerald-500/15 text-emerald-700", valorAberto: 0 };
  }
  if (abertos.some((t) => t.emAcordo)) {
    const valorAberto = abertos.reduce((s, t) => s + Number(t.valor || 0), 0);
    return { status: "acordo", label: "Em acordo", className: "bg-blue-500/15 text-blue-700", valorAberto };
  }
  const maxDia = Math.max(...abertos.map((t) => t.diaRelativo ?? 0));
  const valorAberto = abertos.reduce((s, t) => s + Number(t.valor || 0), 0);
  if (maxDia >= 8) {
    return { status: "critico", label: `Atraso ${maxDia}d`, className: "bg-red-500/15 text-red-700", valorAberto };
  }
  if (maxDia >= 0) {
    return { status: "atrasado", label: maxDia === 0 ? "Vence hoje" : `Atraso ${maxDia}d`, className: "bg-amber-500/15 text-amber-800", valorAberto };
  }
  return { status: "em_dia", label: "Em dia", className: "bg-emerald-500/10 text-emerald-700", valorAberto };
}

export function clientesAtrasoCritico(
  rows: Array<{ cliente_nome: string; diaRelativo: number; status: string }>
): string[] {
  const set = new Set<string>();
  for (const r of rows) {
    if (r.status === "pago" || r.status === "cancelado") continue;
    if ((r.diaRelativo || 0) >= 8) set.add(r.cliente_nome);
  }
  return Array.from(set);
}

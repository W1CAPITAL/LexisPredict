/**
 * KPIs financeiros mínimos + export CSV de inadimplência.
 */

export type TituloFinanceiro = {
  id: string;
  cliente_nome: string;
  descricao?: string;
  valor: number;
  vencimento: string;
  status: string;
  pago_em?: string | null;
  protocolo?: string | null;
};

export type DashFinanceiro = {
  previstoMes: number;
  recebidoMes: number;
  emAberto: number;
  atrasado: number;
  qtdAtrasados: number;
  taxaRecebimentoMes: number; // 0–1
};

function sameMonth(iso: string, ref = new Date()) {
  if (!iso) return false;
  const d = new Date(iso.slice(0, 10) + "T12:00:00");
  return d.getMonth() === ref.getMonth() && d.getFullYear() === ref.getFullYear();
}

function isAtrasado(t: TituloFinanceiro, hoje = new Date()) {
  if (t.status === "pago" || t.status === "cancelado") return false;
  const v = new Date(t.vencimento.slice(0, 10) + "T12:00:00");
  return v.getTime() < new Date(hoje.toDateString()).getTime();
}

export function calcularDash(titulos: TituloFinanceiro[], hoje = new Date()): DashFinanceiro {
  let previstoMes = 0;
  let recebidoMes = 0;
  let emAberto = 0;
  let atrasado = 0;
  let qtdAtrasados = 0;

  for (const t of titulos) {
    const val = Number(t.valor || 0);
    if (t.status === "pago") {
      if (t.pago_em && sameMonth(t.pago_em, hoje)) recebidoMes += val;
      else if (!t.pago_em && sameMonth(t.vencimento, hoje)) recebidoMes += val;
    } else if (t.status !== "cancelado") {
      emAberto += val;
      if (sameMonth(t.vencimento, hoje)) previstoMes += val;
      if (isAtrasado(t, hoje)) {
        atrasado += val;
        qtdAtrasados += 1;
      }
    }
  }

  // previsto = o que vencia no mês (pago ou não) + ainda em aberto do mês
  const previstoTotal = previstoMes + recebidoMes; // approx
  const taxaRecebimentoMes = previstoTotal > 0 ? recebidoMes / (recebidoMes + previstoMes || 1) : 0;

  return {
    previstoMes: previstoMes + recebidoMes,
    recebidoMes,
    emAberto,
    atrasado,
    qtdAtrasados,
    taxaRecebimentoMes,
  };
}

export function exportInadimplenciaCsv(titulos: TituloFinanceiro[]): string {
  const rows = titulos.filter((t) => isAtrasado(t));
  const header = ["cliente", "descricao", "valor", "vencimento", "status", "protocolo"];
  const lines = [header.join(";")];
  for (const t of rows) {
    lines.push(
      [
        csv(t.cliente_nome),
        csv(t.descricao || ""),
        String(t.valor).replace(".", ","),
        t.vencimento.slice(0, 10),
        t.status,
        csv(t.protocolo || ""),
      ].join(";")
    );
  }
  return lines.join("\n");
}

function csv(s: string) {
  const v = String(s).replace(/"/g, '""');
  return `"${v}"`;
}

export function downloadCsv(filename: string, content: string) {
  if (typeof window === "undefined") return;
  const blob = new Blob(["\ufeff" + content], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Histórico de eventos de cobrança (cliente/processo).
 * Pode espelhar tabela crm_receber_eventos ou localStorage até existir no DB.
 */

export type CobrancaEventoTipo =
  | "criado"
  | "lembrete"
  | "contato"
  | "pago"
  | "acordo"
  | "parcela"
  | "cancelado"
  | "recibo";

export type CobrancaEvento = {
  id: string;
  receberId: string;
  clienteNome: string;
  protocolo?: string;
  tipo: CobrancaEventoTipo;
  valor?: number;
  forma?: string; // pix | ted | dinheiro | acordo
  nota?: string;
  at: string; // ISO
};

export type AcordoParcelas = {
  receberId: string;
  clienteNome: string;
  valorTotal: number;
  parcelas: number;
  primeiraData: string; // YYYY-MM-DD
  forma: string;
};

function uid() {
  return `ev_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

const KEY = "lexis_cobranca_historico_v1";

export function loadHistorico(): CobrancaEvento[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(KEY) || "[]") as CobrancaEvento[];
  } catch {
    return [];
  }
}

export function saveHistorico(list: CobrancaEvento[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(list.slice(0, 2000)));
}

export function addEvento(
  partial: Omit<CobrancaEvento, "id" | "at"> & { at?: string }
): CobrancaEvento {
  const ev: CobrancaEvento = {
    ...partial,
    id: uid(),
    at: partial.at || new Date().toISOString(),
  };
  const list = loadHistorico();
  list.unshift(ev);
  saveHistorico(list);
  return ev;
}

export function historicoPorCliente(clienteNome: string): CobrancaEvento[] {
  const nome = clienteNome.trim().toUpperCase();
  return loadHistorico().filter((e) => e.clienteNome.trim().toUpperCase() === nome);
}

export function historicoPorReceber(receberId: string): CobrancaEvento[] {
  return loadHistorico().filter((e) => e.receberId === receberId);
}

/** Gera N parcelas a partir de um acordo (apenas dados; gravação no CRM é action). */
export function gerarParcelasAcordo(a: AcordoParcelas): Array<{
  n: number;
  valor: number;
  vencimento: string;
  descricao: string;
}> {
  const n = Math.max(1, Math.min(24, a.parcelas));
  const base = Math.floor((a.valorTotal / n) * 100) / 100;
  const parcelas = [];
  let soma = 0;
  const start = new Date(a.primeiraData + "T12:00:00");
  for (let i = 0; i < n; i++) {
    const d = new Date(start);
    d.setMonth(d.getMonth() + i);
    const valor = i === n - 1 ? Math.round((a.valorTotal - soma) * 100) / 100 : base;
    soma += valor;
    const venc = d.toISOString().slice(0, 10);
    parcelas.push({
      n: i + 1,
      valor,
      vencimento: venc,
      descricao: `Acordo ${i + 1}/${n} — ${a.clienteNome}`,
    });
  }
  return parcelas;
}

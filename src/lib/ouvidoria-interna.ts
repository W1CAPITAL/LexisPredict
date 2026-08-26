/**
 * Ouvidoria interna — canal de reclamação/dúvida com prazo de resposta (5 dias úteis).
 * Persistido em dados.etica.ouvidoria[]
 */

export type TicketOuvidoria = {
  id: string;
  abertoEm: string;
  prazoRespostaEm: string;
  status: "aberto" | "em_analise" | "respondido" | "encerrado";
  assunto: string;
  descricao: string;
  resposta?: string | null;
  respondidoEm?: string | null;
  responsavel?: string | null;
};

export function gerarIdTicket(): string {
  return `ouv-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

/** Soma N dias úteis (seg–sex) a partir de uma data. */
export function adicionarDiasUteis(from: Date, diasUteis: number): Date {
  const d = new Date(from.getTime());
  let left = diasUteis;
  while (left > 0) {
    d.setDate(d.getDate() + 1);
    const wd = d.getDay();
    if (wd !== 0 && wd !== 6) left -= 1;
  }
  return d;
}

export function criarTicketOuvidoria(input: {
  assunto: string;
  descricao: string;
  prazoDiasUteis?: number;
}): TicketOuvidoria {
  const agora = new Date();
  const prazo = adicionarDiasUteis(agora, input.prazoDiasUteis ?? 5);
  return {
    id: gerarIdTicket(),
    abertoEm: agora.toISOString(),
    prazoRespostaEm: prazo.toISOString(),
    status: "aberto",
    assunto: String(input.assunto || "Sem assunto").slice(0, 120),
    descricao: String(input.descricao || "").slice(0, 2000),
    resposta: null,
    respondidoEm: null,
  };
}

export function responderTicket(
  t: TicketOuvidoria,
  resposta: string,
  responsavel?: string
): TicketOuvidoria {
  return {
    ...t,
    status: "respondido",
    resposta: String(resposta || "").slice(0, 4000),
    respondidoEm: new Date().toISOString(),
    responsavel: responsavel || t.responsavel || null,
  };
}

export function ticketAtrasado(t: TicketOuvidoria, agora = new Date()): boolean {
  if (t.status === "respondido" || t.status === "encerrado") return false;
  return new Date(t.prazoRespostaEm).getTime() < agora.getTime();
}

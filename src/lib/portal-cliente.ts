/**
 * Contrato mínimo de “visão do cliente”.
 * Inspirado em: JusTraduz (cliente vê andamento, chat, agenda) + Entenda Direito
 *
 * Não é a UI completa — é o shape de dados + helpers para um portal futuro.
 */

import { simplificarJuridiques, resumoParaCliente } from "./simplificar-juridiques";

export type PortalAndamento = {
  data: string;
  tituloSimples: string;
  detalheSimples?: string;
  fonte: "datajud" | "djen" | "interno";
};

export type PortalProcesso = {
  protocoloMascarado: string; // *****.****.*.**.1234
  statusSimples: string;
  proximaAcao?: string;
  andamentos: PortalAndamento[];
  cobranca?: { emAtraso: boolean; mensagem?: string };
};

export function mascararCnj(cnj: string): string {
  const d = String(cnj || "").replace(/\D/g, "");
  if (d.length < 4) return "****";
  return `*****.****.*.**.${d.slice(-4)}`;
}

export function montarAndamentoPortal(opts: {
  data: string;
  teorBruto: string;
  fonte: PortalAndamento["fonte"];
}): PortalAndamento {
  const { simples } = simplificarJuridiques(opts.teorBruto);
  const tituloSimples = resumoParaCliente(simples, 120);
  return {
    data: opts.data,
    tituloSimples,
    detalheSimples: simples !== tituloSimples ? simples : undefined,
    fonte: opts.fonte,
  };
}

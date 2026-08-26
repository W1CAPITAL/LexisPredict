/**
 * Substabelecimento / indicação de advogado — transparência OAB e honorários.
 * Cliente sabe quem é o advogado e o que paga.
 */

export type AdvogadoParceiro = {
  nome: string;
  oab: string; // ex. OAB/SP 123456
  email?: string | null;
  telefone?: string | null;
};

export type RegistroSubstabelecimento = {
  advogado: AdvogadoParceiro;
  /** com ou sem reserva de poderes */
  comReserva: boolean;
  data?: string | null;
  /** resumo do contrato de honorários entregue ao cliente */
  honorariosResumo: string;
  /** cliente recebeu cópia do contrato de honorários do advogado */
  contratoHonorariosEntregue: boolean;
  /** URL ou id do anexo (opcional) */
  anexoContratoId?: string | null;
  updatedAt?: string;
};

export function emptySubstabelecimento(): RegistroSubstabelecimento {
  return {
    advogado: { nome: "", oab: "", email: null, telefone: null },
    comReserva: true,
    data: null,
    honorariosResumo: "",
    contratoHonorariosEntregue: false,
    anexoContratoId: null,
  };
}

export function substabelecimentoValido(r: RegistroSubstabelecimento): boolean {
  return !!(
    r.advogado.nome.trim() &&
    r.advogado.oab.trim() &&
    r.contratoHonorariosEntregue &&
    r.honorariosResumo.trim().length >= 10
  );
}

export function textoResumoSubstabelecimento(r: RegistroSubstabelecimento): string {
  if (!r.advogado.nome) return "Advogado ainda não indicado.";
  return [
    `Advogado: ${r.advogado.nome} (${r.advogado.oab})`,
    r.comReserva ? "Substabelecimento com reserva de poderes." : "Substabelecimento sem reserva de poderes.",
    r.contratoHonorariosEntregue
      ? "Contrato de honorários do advogado entregue ao cliente."
      : "ATENÇÃO: contrato de honorários ainda não entregue.",
    r.honorariosResumo ? `Honorários: ${r.honorariosResumo}` : null,
  ]
    .filter(Boolean)
    .join(" ");
}

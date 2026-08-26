/**
 * Carta de desistência clara — sem ambiguidade sobre reembolso e serviços já prestados.
 */

export type InputCartaDesistencia = {
  nomeCliente: string;
  documentoCliente?: string | null;
  protocolo?: string | null;
  empresa: string;
  data?: string | null;
  servicosJaPrestados?: string | null;
  /** texto livre opcional */
  motivo?: string | null;
};

export function gerarCartaDesistencia(input: InputCartaDesistencia): string {
  const data =
    input.data ||
    new Date().toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    });
  const doc = input.documentoCliente ? `, inscrito(a) no CPF/CNPJ ${input.documentoCliente}` : "";
  const ref = input.protocolo ? `Referência do caso: ${input.protocolo}.` : "";
  const prestados =
    input.servicosJaPrestados?.trim() ||
    "diagnóstico e/ou tentativa extrajudicial já realizados conforme contrato";

  return [
    `CARTA DE DESISTÊNCIA`,
    ``,
    `${data}`,
    ``,
    `Eu, ${input.nomeCliente || "[nome]"}${doc}, manifesto de forma livre e informada a desistência dos serviços ainda não prestados junto à ${input.empresa || "[empresa]"}.`,
    ref,
    ``,
    `Declaro que:`,
    `1. Fui informado(a) sobre a natureza dos serviços (extrajudicial e, se contratado, judicial) e de que não há garantia de resultado.`,
    `2. Os valores eventualmente já pagos referentes a ${prestados} correspondem a serviços efetivamente prestados e, nos termos do contrato, não são reembolsáveis, salvo disposição expressa em contrário no contrato assinado.`,
    `3. Solicito o encerramento do acompanhamento a partir desta data e o envio de relatório do que foi feito até aqui.`,
    input.motivo?.trim() ? `4. Motivo informado (opcional): ${input.motivo.trim()}` : null,
    ``,
    `Local e data: _______________________`,
    ``,
    `Assinatura do cliente: _______________________`,
    `Nome legível: ${input.nomeCliente || "_______________________"}`,
  ]
    .filter((l) => l !== null)
    .join("\n");
}

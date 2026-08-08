/**
 * Taxas médias de mercado — referência BACEN (Pesquisa de Juros, divulgação mais
 * recente). Utilizadas para fundamentar a revisão contratual no Revisional Admin.
 * Fonte pública: Banco Central do Brasil — sistema PTAX/Pesquisa de Juros.
 * Valores curáveis; revisar periodicamente.
 * @copyright 2026 Davi Alves Figueredo / W1 Capital Assessoria Financeira Ltda.
 */

export interface TaxaBacen {
  modalidade: string;
  taxaAa: number;
  periodo: string;
}

export const TAXAS_BACEN: TaxaBacen[] = [
  { modalidade: "Cartão de crédito — rotativo", taxaAa: 391.1, periodo: "última divulgação BACEN" },
  { modalidade: "Cartão de crédito — parcelado", taxaAa: 101.1, periodo: "última divulgação BACEN" },
  { modalidade: "Cheque especial", taxaAa: 133.4, periodo: "última divulgação BACEN" },
  { modalidade: "Crédito pessoal consignado — INSS", taxaAa: 22.5, periodo: "última divulgação BACEN" },
  { modalidade: "Crédito pessoal consignado — público", taxaAa: 22.4, periodo: "última divulgação BACEN" },
  { modalidade: "Crédito pessoal não consignado", taxaAa: 81.8, periodo: "última divulgação BACEN" },
  { modalidade: "Antecipação de FGTS", taxaAa: 29.5, periodo: "última divulgação BACEN" },
  { modalidade: "Veículos — pessoa física", taxaAa: 21.6, periodo: "última divulgação BACEN" },
  { modalidade: "Imobiliário — SFH", taxaAa: 9.9, periodo: "última divulgação BACEN" },
  { modalidade: "Capital de giro — pessoa jurídica", taxaAa: 17.4, periodo: "última divulgação BACEN" },
  { modalidade: "Financiamento imobiliário — taxas pós-fixadas", taxaAa: 8.1, periodo: "última divulgação BACEN" },
];

export function taxaSugeridaPorModalidade(chave: string): number | null {
  const c = chave.toLowerCase();
  if (/cartao|rotativo|crédito.?card|credit.*card/i.test(c)) return TAXAS_BACEN[0].taxaAa;
  if (/imobili|sfh|financiamento/i.test(c)) return 9.9;
  if (/ve[íi]cul|auto/i.test(c)) return 21.6;
  if (/consignado/i.test(c)) return 22.5;
  return null;
}

import { describe, expect, it } from "vitest";
import {
  buildLegalDocument,
  LEGAL_DOCUMENT_TEMPLATES,
  type LegalDocumentData,
} from "./legal-document-generator";

const base: LegalDocumentData = {
  juizo: "AO JUÍZO DA 1ª VARA CÍVEL DA COMARCA DE SÃO PAULO/SP",
  processo: "1000000-00.2026.8.26.0001",
  autor: "CLIENTE TESTE",
  reu: "EMPRESA TESTE",
  clienteNome: "CLIENTE TESTE",
  cpf: "000.000.000-00",
  advogadoNome: "ADVOGADO TESTE",
  oab: "SP 000000",
  advogadoAnteriorNome: "ADVOGADO ANTERIOR",
  oabAnterior: "SP 111111",
  advogadoNovoNome: "ADVOGADO NOVO",
  oabNovo: "SP 222222",
  cidade: "São Paulo/SP",
  dataExtenso: "30 de setembro de 2026",
  fatos: "Fatos documentados nos autos.",
  fundamentos: "Fundamentos a revisar.",
  pedidos: "Requer o acolhimento dos pedidos cabíveis.",
};

describe("legal document generator", () => {
  it("contains every requested core document family", () => {
    const ids = new Set(LEGAL_DOCUMENT_TEMPLATES.map((x) => x.id));
    [
      "peticao-inicial",
      "procuracao",
      "substabelecimento-com-reserva",
      "substabelecimento-sem-reserva",
      "revogacao-mandato",
      "replica",
      "impugnacao",
      "pugnacao",
      "declaracao-hipossuficiencia",
      "mle-tjsp",
      "notificacao-extrajudicial",
      "apelacao",
      "recurso-inominado",
      "cumprimento-sentenca",
    ].forEach((id) => expect(ids.has(id as any)).toBe(true));
  });

  it("does not silently add unselected special powers to a procuração", () => {
    const result = buildLegalDocument("procuracao", {
      ...base,
      specialPowers: ["transigir", "dar quitação"],
    });
    expect(result.text).toContain("transigir");
    expect(result.text).toContain("dar quitação");
    expect(result.text).not.toContain("confessar,");
    expect(result.text).not.toContain("assinar declaração de hipossuficiência");
  });

  it("warns when substabelecimento sem reserva lacks client knowledge confirmation", () => {
    const result = buildLegalDocument("substabelecimento-sem-reserva", {
      ...base,
      clienteCienteSemReserva: false,
    });
    expect(result.warnings.join(" ")).toMatch(/conhecimento do cliente/i);
  });

  it("keeps MLE fields explicit and warns until banking data are checked", () => {
    const result = buildLegalDocument("mle-tjsp", {
      ...base,
      beneficiario: "CLIENTE TESTE",
      cpfBeneficiario: "000.000.000-00",
      formaRecebimento: "PIX",
      chavePix: "cliente@example.com",
      dadosBancariosConferidos: false,
    });
    expect(result.text).toMatch(/MANDADO DE LEVANTAMENTO ELETRÔNICO/i);
    expect(result.text).toMatch(/Nome do Credor \/ Beneficiário/i);
    expect(result.text).toMatch(/Forma de recebimento/i);
    expect(result.text).toMatch(/Chave PIX/i);
    expect(result.warnings.join(" ")).toMatch(/dados bancários/i);
  });

  it("requires a calculation memory for cumprimento de sentença", () => {
    const result = buildLegalDocument("cumprimento-sentenca", {
      ...base,
      decisao: "Sentença transitada em julgado.",
      memoriaCalculo: "",
    });
    expect(result.text).toMatch(/DEMONSTRATIVO DISCRIMINADO E ATUALIZADO/i);
    expect(result.warnings.join(" ")).toMatch(/demonstrativo/i);
  });

  it("generates distinct appeal structures for CPC and JEC", () => {
    const appeal = buildLegalDocument("apelacao", { ...base, revisouPrazo: true });
    const jec = buildLegalDocument("recurso-inominado", { ...base, revisouPrazo: true });
    expect(appeal.text).toMatch(/RECURSO DE APELAÇÃO/i);
    expect(jec.text).toMatch(/RECURSO INOMINADO/i);
    expect(appeal.template.legalBasis.join(" ")).toMatch(/1\.009/);
    expect(jec.template.legalBasis.join(" ")).toMatch(/9\.099/);
  });
});

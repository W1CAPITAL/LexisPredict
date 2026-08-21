import { describe, it, expect } from "vitest";
import { auditarTextoJuridico, garantirDisclaimerOab } from "@/lib/anti-alucinacao";
import { simplificarJuridiques, resumoParaCliente } from "@/lib/simplificar-juridiques";
import { normalizarCnj, sanearLoteDatajud } from "@/lib/datajud-sanitize";
import { calcularRisco } from "@/lib/risco-carteira";
import { mapearFaseLexis, resumirFunil } from "@/lib/funil-processual";
import { sugerirRoteiro } from "@/lib/roteiro-situacao";
import { mascararCnj } from "@/lib/portal-cliente";

describe("lote especial", () => {
  it("anti-alucinação marca citações", () => {
    const r = auditarTextoJuridico("Conforme Súmula 123 e art. 5º, o valor é R$ 1.000,00");
    expect(r.citacoes.length).toBeGreaterThan(0);
    expect(r.disclaimerOab).toMatch(/OAB/);
    expect(garantirDisclaimerOab("texto")).toMatch(/OAB/);
  });

  it("simplifica juridiquês", () => {
    const r = simplificarJuridiques("Houve trânsito em julgado da sentença");
    expect(r.simples.toLowerCase()).toMatch(/definitiv/);
    expect(resumoParaCliente(r.simples, 50).length).toBeLessThanOrEqual(51);
  });

  it("normaliza CNJ e sanea movimentos", () => {
    const n = normalizarCnj("00012345620238150001");
    expect(n.ok).toBe(true);
    const lote = sanearLoteDatajud(n.cnj!, [
      { codigo: 1, nome: "Distribuição", dataHora: "2023-01-01" },
      { codigo: 1, nome: "Distribuição", dataHora: "2023-01-01" },
    ]);
    expect(lote.movimentos.length).toBe(1);
  });

  it("calcula risco crítico para BA", () => {
    const r = calcularRisco({ temBuscaApreensao: true, diasSemRetornoCliente: 20 });
    expect(r.nivel === "critico" || r.nivel === "alto").toBe(true);
    expect(r.score).toBeGreaterThanOrEqual(45);
  });

  it("funil e roteiro", () => {
    expect(mapearFaseLexis("cumprimento de sentença")).toBe("cumprimento");
    const f = resumirFunil([
      { id: "1", fase: "entrada" },
      { id: "2", fase: "encerrado" },
    ]);
    expect(f.taxaEncerramento).toBe(0.5);
    expect(sugerirRoteiro({ temBuscaApreensao: true })?.id).toBe("ba-risco");
  });

  it("mascara CNJ no portal", () => {
    expect(mascararCnj("0001234-56.2023.8.15.0001")).toMatch(/\d{4}$/);
  });
});

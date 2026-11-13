import { describe, expect, it } from "vitest";
import { classificarTestes, sinalParaTexto } from "../../scripts/selfimprove/collect.mjs";

describe("integridade dos resultados do autoaprimoramento", () => {
  it("não transforma falhas em aprovação", () => {
    const estado = classificarTestes({ ok: false, saida: "FAIL pacote.test.ts\n" }, true);
    expect(estado.testesStatus).toBe("failed");
    expect(estado.testesOk).toBe(false);
    expect(estado.falhasTeste).toContain("pacote.test.ts");
  });

  it("registra testes pulados sem afirmar aprovação", () => {
    expect(classificarTestes(null, false)).toEqual({
      testesStatus: "skipped", testesOk: null, falhasTeste: [],
    });
  });

  it("registra ausência do executor como não executado", () => {
    const estado = classificarTestes({ ok: false, saida: "", naoExecutado: true }, true);
    expect(estado.testesStatus).toBe("not_run");
    expect(estado.testesOk).toBeNull();
  });

  it("apresenta status pulado explicitamente ao modelo", () => {
    const resumo = sinalParaTexto({
      ciclo: "20261113-1800", versaoApp: "2.0",
      saude: { typecheckOk: true, errosTsc: [], ...classificarTestes(null, false) },
      tamanho: { arquivos: 0, linhas: 0 }, inbox: [], todos: [],
    });
    expect(resumo).toContain("Testes: NÃO EXECUTADOS (ignorados por opção)");
    expect(resumo).not.toContain("Testes: OK");
  });
});

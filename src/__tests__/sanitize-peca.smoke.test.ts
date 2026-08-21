import { describe, it, expect } from "vitest";
import { sanitizePecaTexto } from "@/lib/pecas-sanitize";

describe("sanitizePecaTexto", () => {
  it("remove placeholders de banco", () => {
    const out = sanitizePecaTexto("Cliente X [BANCO XYZ] inscrito");
    expect(out).not.toMatch(/\[BANCO/i);
  });

  it("remove frase de banco quando includeBanco=false", () => {
    const out = sanitizePecaTexto("Petição, promovida contra Banco Foo S.A., restante", {
      includeBanco: false,
    });
    expect(out.toLowerCase()).not.toContain("promovida contra");
  });

  it("não quebra com string vazia", () => {
    expect(sanitizePecaTexto("")).toBe("");
    expect(sanitizePecaTexto(null as unknown as string)).toBe("");
  });
});

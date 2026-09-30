import { describe, expect, it } from "vitest";
import {
  hrefLiberado,
  normalizePlanId,
  pacotesDoPlano,
  planTemScanner,
} from "./planos-pacotes";

describe("commercial plan contract", () => {
  it("desconhecido cai no Essencial, nunca no Máximo", () => {
    expect(normalizePlanId("")).toBe("essencial");
    expect(normalizePlanId("plano-invalido")).toBe("essencial");
  });

  it("Essencial libera núcleo e bloqueia módulos pagos extras", () => {
    expect(hrefLiberado("/cases", "essencial")).toBe(true);
    expect(hrefLiberado("/tarefas", "essencial")).toBe(true);
    expect(hrefLiberado("/crm", "essencial")).toBe(false);
    expect(hrefLiberado("/busca-apreensao", "essencial")).toBe(false);
  });

  it("Operacional libera tribunal e scanner sem liberar financeiro", () => {
    expect(planTemScanner("operacional")).toBe(true);
    expect(hrefLiberado("/busca-apreensao", "operacional")).toBe(true);
    expect(hrefLiberado("/gerador-processos", "operacional")).toBe(true);
    expect(hrefLiberado("/crm", "operacional")).toBe(false);
  });

  it("Financeiro libera CRM sem liberar scanner judicial", () => {
    expect(hrefLiberado("/crm", "financeiro")).toBe(true);
    expect(hrefLiberado("/financas", "financeiro")).toBe(true);
    expect(planTemScanner("financeiro")).toBe(false);
  });

  it("Máximo contém todos os pacotes", () => {
    expect(pacotesDoPlano("maximo")).toEqual(["essencial", "operacional", "financeiro"]);
    expect(hrefLiberado("/security", "maximo")).toBe(true);
    expect(planTemScanner("maximo")).toBe(true);
  });
});

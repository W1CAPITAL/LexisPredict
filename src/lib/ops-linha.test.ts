import { describe, expect, it } from "vitest";
import { compareOps, computeOpsKpis, computeOpsLinha } from "./ops-linha";

describe("ops-linha", () => {
  it("BA real ganha de silêncio e de jurisprudência", () => {
    const ba = computeOpsLinha({
      classe_processual: "Busca e Apreensão",
      evento_resumo: "Mandado de busca expedido",
      status: "No Prazo",
    } as any);
    const fake = computeOpsLinha({
      classe: "Procedimento Comum",
      evento_resumo: "Ação de busca e apreensão nesse sentido",
      status: "No Prazo",
    } as any);
    expect(ba.baReal).toBe(true);
    expect(ba.score).toBeGreaterThan(fake.score);
  });

  it("réplica pendente sobe na fila", () => {
    const r = computeOpsLinha({
      evento_resumo: "Contestação apresentada. Prazo para réplica.",
      status: "No Prazo",
    } as any);
    expect(r.score).toBeGreaterThanOrEqual(80);
    expect(r.tags.some((t) => /réplica/i.test(t) || r.fase.includes("Réplica"))).toBe(true);
  });

  it("KPIs ignoram encerrado", () => {
    const k = computeOpsKpis([
      { situacao: "ENCERRADO", status: "Arquivado", evento_resumo: "baixa" } as any,
      {
        situacao: "EM ANDAMENTO",
        status: "Vencido",
        evento_resumo: "Contestação. Prazo para réplica.",
      } as any,
    ]);
    expect(k.ativos).toBe(1);
    expect(k.vencidos).toBe(1);
  });

  it("compareOps ordena maior score primeiro", () => {
    const a = { status: "No Prazo", evento_resumo: "citação" } as any;
    const b = { status: "Vencido", evento_resumo: "prazo" } as any;
    expect(compareOps(a, b)).toBeGreaterThan(0);
  });
});

import { describe, expect, it } from "vitest";
import { buildLegalWorkflow, formatLegalWorkflowReport } from "./legal-workflow";

const baseCase = {
  cliente: "Cliente Teste",
  protocolo: "0000000-00.2026.8.26.0001",
  tribunal: "TJSP",
  status: "No Prazo",
};

describe("workflow jurídico orientado por evidências", () => {
  it("creates a DJEN review step without inventing a judicial deadline", () => {
    const result = buildLegalWorkflow({
      ...baseCase,
      djen_nova_comunicacao: true,
      djen_ultima_data: "2026-11-11",
      djen_ultimo_resumo: "Intimação para manifestação.",
    }, new Date("2026-11-12T12:00:00-03:00"));

    expect(result.signals).toContain("publicacao_djen");
    expect(result.steps.some((step) => /DJEN/i.test(step.title))).toBe(true);
    expect(result.steps.map((step) => step.detail).join(" ")).toMatch(/prazo.*registrar|registrar.*prazo/i);
    expect(result.steps.map((step) => step.detail).join(" ")).not.toMatch(/prazo de \d+ dias/i);
  });

  it("creates a hearing preparation workflow only when the case has a hearing signal", () => {
    const result = buildLegalWorkflow({
      ...baseCase,
      evento_tipo: "audiencia_instrucao",
      evento_data: "2026-11-20",
    });

    expect(result.signals).toContain("audiencia");
    expect(result.steps.some((step) => /audiência/i.test(step.title))).toBe(true);
  });

  it("separates judgment review from enforcement follow-up", () => {
    const result = buildLegalWorkflow({
      ...baseCase,
      evento_tipo: "sentenca_parcial",
      evento_resumo: "Sentença parcialmente procedente.",
      em_cumprimento_sentenca: true,
    });

    expect(result.signals).toContain("sentenca");
    expect(result.signals).toContain("cumprimento");
    expect(result.steps.some((step) => /sentença/i.test(step.title))).toBe(true);
    expect(result.steps.some((step) => /cumprimento/i.test(step.title))).toBe(true);
  });

  it("treats a low-confidence search-and-seizure flag as an alert requiring human validation", () => {
    const result = buildLegalWorkflow({
      ...baseCase,
      indicio_busca_apreensao: true,
      busca_apreensao_confianca: "baixa",
      busca_apreensao_motivo: "Termo encontrado em movimentação.",
    });

    expect(result.signals).toContain("busca_apreensao");
    expect(result.steps[0]?.priority).toBe("critical");
    expect(result.warnings.join(" ")).toMatch(/validação humana|documento oficial/i);
  });

  it("preserves enforcement follow-up even when the court record signals closure", () => {
    const result = buildLegalWorkflow({
      ...baseCase,
      datajud_encerrado_tribunal: true,
      em_cumprimento_sentenca: true,
      status: "Baixado",
    });

    expect(result.isClosed).toBe(true);
    expect(result.signals).toContain("encerramento");
    expect(result.signals).toContain("cumprimento");
    expect(result.steps.some((step) => /cumprimento/i.test(step.title))).toBe(true);
  });

  it("labels an overdue return as operational, not as a judicial deadline", () => {
    const result = buildLegalWorkflow({
      ...baseCase,
      proximo_retorno: "2026-11-10",
    }, new Date("2026-11-12T12:00:00-03:00"));

    expect(result.signals).toContain("retorno_operacional");
    expect(result.steps.some((step) => /retorno operacional/i.test(step.title))).toBe(true);
    expect(result.warnings.join(" ")).toMatch(/não é prazo processual/i);
  });

  it("provides a verification step when the case has no usable operational signal", () => {
    const result = buildLegalWorkflow(baseCase);

    expect(result.steps.length).toBeGreaterThan(0);
    expect(result.steps[0]?.id).toBe("consultar_fonte_oficial");
    expect(result.warnings.join(" ")).toMatch(/nenhum sinal/i);
  });

  it("formats the plan as read-only and never claims to send or change anything", () => {
    const result = buildLegalWorkflow({
      ...baseCase,
      djen_nova_comunicacao: true,
    });
    const report = formatLegalWorkflowReport(result);

    expect(report).toContain("Fluxo jurídico sugerido");
    expect(report).toMatch(/não envia|não altera|não cria tarefas/i);
    expect(report).toContain(baseCase.protocolo);
  });
});

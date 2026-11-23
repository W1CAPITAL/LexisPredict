import { describe, expect, it } from "vitest";
import { FIRST_PROCESSES_PAGE_LIMIT, shouldRefreshCompanyProcesses } from "./processos-refresh-policy";

describe("carregamento leve da carteira empresarial", () => {
  it("busca somente uma página pequena na primeira abertura", () => {
    expect(FIRST_PROCESSES_PAGE_LIMIT).toBeLessThanOrEqual(36);
    expect(FIRST_PROCESSES_PAGE_LIMIT).toBeGreaterThanOrEqual(24);
  });

  it("não repete a carteira quando a janela recebe foco após poucos segundos", () => {
    expect(shouldRefreshCompanyProcesses(100_000, 120_000, false)).toBe(false);
  });

  it("revalida se o estado tem mais de três minutos ou houve invalidação", () => {
    expect(shouldRefreshCompanyProcesses(100_000, 281_000, false)).toBe(true);
    expect(shouldRefreshCompanyProcesses(100_000, 120_000, true)).toBe(true);
    expect(shouldRefreshCompanyProcesses(0, 120_000, false)).toBe(true);
  });
});

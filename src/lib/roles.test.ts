import { describe, expect, it } from "vitest";
import {
  canAccessSecurity,
  canAccessSuperadmin,
  canDeleteCase,
  canExportOperationalData,
  canRunOperationalScanner,
  canSeeCompanyProcesses,
  canSuperviseCompany,
  canUseAllOperationalFeatures,
  operatorRouteAllowed,
  resolveCaseScope,
  resolveRole,
} from "./roles";

describe("commercial role contract", () => {
  it("normaliza os cargos oficiais", () => {
    expect(resolveRole("Operador")).toBe("Operador");
    expect(resolveRole("Administrador")).toBe("Administrador");
    expect(resolveRole("Supervisor")).toBe("Supervisor");
    expect(resolveRole("Superadmin")).toBe("Superadmin");
    expect(resolveRole("Visualizador")).toBe("Visualizador");
    expect(resolveRole({ role: "admin" })).toBe("Administrador");
    expect(resolveRole({ role: "supervisor" })).toBe("Supervisor");
  });

  it("centraliza o escopo mine versus company", () => {
    expect(resolveCaseScope("Operador")).toBe("mine");
    expect(resolveCaseScope("Administrador")).toBe("mine");
    expect(resolveCaseScope("Visualizador")).toBe("mine");
    expect(resolveCaseScope("Supervisor")).toBe("empresa");
    expect(resolveCaseScope("Superadmin")).toBe("empresa");
  });

  it("Administrador tem operação completa sem visão da empresa", () => {
    expect(canUseAllOperationalFeatures("Administrador")).toBe(true);
    expect(canRunOperationalScanner("Administrador")).toBe(true);
    expect(canExportOperationalData("Administrador")).toBe(true);
    expect(canDeleteCase("Administrador")).toBe(true);
    expect(canSeeCompanyProcesses("Administrador")).toBe(false);
    expect(canSuperviseCompany("Administrador")).toBe(false);
  });

  it("Supervisor tem visão consolidada da empresa", () => {
    expect(canSeeCompanyProcesses("Supervisor")).toBe(true);
    expect(canSuperviseCompany("Supervisor")).toBe(true);
  });

  it("Superadmin é o único cargo com Segurança e Superadmin", () => {
    expect(canAccessSecurity("Superadmin")).toBe(true);
    expect(canAccessSuperadmin("Superadmin")).toBe(true);
    for (const role of ["Supervisor", "Administrador", "Operador", "Visualizador"]) {
      expect(canAccessSecurity(role)).toBe(false);
      expect(canAccessSuperadmin(role)).toBe(false);
    }
  });

  it("Operador fica no conjunto reduzido de rotas", () => {
    for (const path of ["/", "/cases", "/tarefas", "/agenda", "/whatsapp", "/documents", "/mensagens", "/notes", "/onboarding", "/settings"]) {
      expect(operatorRouteAllowed(path)).toBe(true);
    }
    for (const path of ["/processos", "/supervisao", "/team", "/auditoria", "/crm", "/financas", "/security", "/superadmin"]) {
      expect(operatorRouteAllowed(path)).toBe(false);
    }
  });
});

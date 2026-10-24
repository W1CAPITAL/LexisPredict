import { describe, expect, it } from "vitest";
import {
  canAccessSecurity,
  canAccessSuperadmin,
  canDeleteCase,
  canExportOperationalData,
  canRunOperationalScanner,
  canSeeCompanyProcesses,
  canViewCompanyCaseList,
  canOperateCompanyCases,
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

  it("Todos os perfis logados podem consultar /processos sem ampliar a carteira pessoal", () => {
    for (const cargo of ["Operador", "Administrador", "Supervisor", "Superadmin", "Visualizador"]) {
      expect(canViewCompanyCaseList(cargo)).toBe(true);
    }
    expect(canViewCompanyCaseList(null)).toBe(false);
    expect(resolveCaseScope("Operador")).toBe("mine");
  });

  it("P0: todos os perfis da mesma empresa podem operar /processos, sem cargo especial", () => {
    const cargos=["Operador","Administrador","Visualizador","Supervisor","Superadmin"];
    for (const cargo of cargos) {
      expect(canOperateCompanyCases({auth_id:"login-verificado",empresa_id:"empresa-auth"}),cargo).toBe(true);
    }
    expect(canOperateCompanyCases({auth_id:null,empresa_id:"empresa-auth"})).toBe(false);
    expect(canOperateCompanyCases({auth_id:"login-verificado",empresa_id:null})).toBe(false);
    // Exportações gerenciais NÃO se tornam públicas com a colaboração da carteira.
    expect(canExportOperationalData("Visualizador")).toBe(false);
    expect(canAccessSecurity("Operador")).toBe(false);
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
    for (const path of ["/", "/cases", "/processos", "/tarefas", "/agenda", "/whatsapp", "/documents", "/mensagens", "/notes", "/onboarding", "/settings"]) {
      expect(operatorRouteAllowed(path)).toBe(true);
    }
    for (const path of ["/supervisao", "/team", "/auditoria", "/security", "/superadmin"]) {
      expect(operatorRouteAllowed(path)).toBe(false);
    }
  });
});

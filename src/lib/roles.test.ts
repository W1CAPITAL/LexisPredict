import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  canAccessSecurity,
  canAccessSuperadmin,
  canDeleteCase,
  canExportOperationalData,
  canRunOperationalScanner,
  canSeeCompanyProcesses,
  canViewCompanyCaseList,
  canOperateCompanyCases,
  canViewCompanyAnalyses,
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

  it("P0: /analises-internas é legível por todo cargo autenticado da empresa", () => {
    for (const role of ["Operador", "Administrador", "Supervisor", "Superadmin", "Visualizador"]) {
      expect(canViewCompanyAnalyses({ auth_id: "sessao-" + role, empresa_id: "empresa-123" })).toBe(true);
    }
    expect(canViewCompanyAnalyses({ auth_id: null, empresa_id: "empresa-123" })).toBe(false);
    expect(canViewCompanyAnalyses({ auth_id: "sessao-validada", empresa_id: null })).toBe(false);
    expect(operatorRouteAllowed("/analises-internas")).toBe(true);

    // Proteção contra reintroduzir um ID fixo de responsável ou regra de supervisor.
    const page = readFileSync(resolve(process.cwd(), "src/app/analises-internas/page.tsx"), "utf8");
    expect(page).toContain("canViewCompanyAnalyses(ctx)");
    expect(page).not.toMatch(/ctx\.isSupervisor|ctx\.isSuperAdmin|const davi=/);
    expect(page).toContain('.eq("empresa_id",empresa)');
  });

  it("P0: análises internas mostra somente os registros atribuídos ao usuário logado", () => {
    const page = readFileSync(resolve(process.cwd(), "src/app/analises-internas/page.tsx"), "utf8");
    const lib = readFileSync(resolve(process.cwd(), "src/lib/analises-internas.ts"), "utf8");
    expect(page).toContain("const usuario=String(ctx.auth_id)");
    expect(page).toContain('.eq("empresa_id",empresa)');
    expect(page).toContain('.eq("responsavel_auth_user_id",usuario)');
    expect(page).toContain('query.order("data_atividade"');
    expect(page).toContain('tarefasQuery.order("data_realizacao"');
    expect(page).toContain('acoesQuery.order("created_at"');
    expect(page).toContain('.eq("auth_user_id",usuario)');
    expect(page).toContain('["edicao","atendimento"]');
    expect(page).not.toContain("getResumoAnalisesDoUsuario(");
    expect(page).toContain("{x.responsavel_nome}");
    expect(page).not.toContain("Análises e investigações de Davi");
    expect(page).not.toContain("<b>Davi Alves Figueredo</b>");
    // A função gerencial continua separada; a página individual usa apenas
    // consultas limitadas (nenhuma varredura paginada completa dos 6 mil registros).
    expect(page).not.toContain("await getResumoAnalisesDoUsuario(");
    expect(page).toContain('const [analisesResult,tarefasResult,acoesResult,docsResult,replicasResult]=await Promise.all');
    expect(page).toContain('head:true,count:"exact"');
    expect(page).toContain("taskLimit=25");
    expect(page).toContain("actionLimit=20");
    expect(lib).toContain("getResumoAnalisesDaEmpresa");
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

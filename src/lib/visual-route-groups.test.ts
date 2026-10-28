import { describe, it, expect } from "vitest";
import { getVisualRouteGroup, VISUAL_ROUTE_SEGMENTS } from "./visual-route-groups";

/** Snapshot of the 105 page.tsx paths in main at the time of the visual pass.
 * This is intentionally explicit: changes to navigation should update this test. */
const EXISTING_PAGE_PATHS = [
  "/agenda",
  "/ai-lab",
  "/analises-internas",
  "/analytics",
  "/auditoria",
  "/autoaprimoramento",
  "/automacao-judicial",
  "/busca-apreensao",
  "/calculos",
  "/cases",
  "/chat-ia",
  "/chat",
  "/chatbot-separado",
  "/clients",
  "/companies/[id]",
  "/companies",
  "/consulta-bases",
  "/crm/a-receber",
  "/crm/agentes",
  "/crm/atividades",
  "/crm/cobranca",
  "/crm/conciliacao",
  "/crm/contatos",
  "/crm/extrato",
  "/crm/financeiro",
  "/crm/followups",
  "/crm/fornecedores",
  "/crm/funil",
  "/crm",
  "/crm/servicos",
  "/cumprimentos-procedentes",
  "/db-csv",
  "/deals",
  "/desktop",
  "/documents/generator",
  "/documents/investigacao",
  "/documents",
  "/dossies",
  "/efferd-demo",
  "/encerrados-revisao",
  "/estatistica-cnj",
  "/estudio-agentes",
  "/etica-operacional",
  "/fases-provas",
  "/financas",
  "/gerador-processos",
  "/habilitacao-peca",
  "/ia-sync",
  "/import",
  "/insights",
  "/integracoes",
  "/investigacao-predatoria",
  "/juridico",
  "/login",
  "/mapa-codigo",
  "/mensagens",
  "/minhas-atividades",
  "/modelos",
  "/modo-seguranca",
  "/notes",
  "/notificacoes",
  "/offline",
  "/onboarding",
  "/ops",
  "/",
  "/people",
  "/plano-b",
  "/planos",
  "/plugins",
  "/premios",
  "/primeiro-acesso",
  "/processos-parados",
  "/processos",
  "/report/completo",
  "/report",
  "/revisional",
  "/revogacao-poderes",
  "/security",
  "/settings/ops",
  "/settings",
  "/setup-empresa",
  "/setup-planilha",
  "/signup",
  "/substabelecimento-peca",
  "/substabelecimento-simples",
  "/substabelecimento",
  "/superadmin",
  "/superagente",
  "/supervisao",
  "/tarefas",
  "/team",
  "/termos",
  "/termos/renovacao-assinatura",
  "/tools/auditoria-contrato",
  "/tools/automacao",
  "/tools/navegador",
  "/tools/ocr",
  "/urgency",
  "/vencidos",
  "/veredito",
  "/visualizador-csv",
  "/visualizador-db",
  "/vitrine-fx",
  "/whatsapp",
  "/world-lab"
] as const;

describe("visual coverage across all existing routes", () => {
  it("covers all 105 pages, not only the four manually retouched screens", () => {
    expect(EXISTING_PAGE_PATHS).toHaveLength(105);
    for (const path of EXISTING_PAGE_PATHS) {
      expect(getVisualRouteGroup(path), path).not.toBe("general");
    }
  });

  it("applies one visual family to each of the existing route segments", () => {
    const all = Object.values(VISUAL_ROUTE_SEGMENTS).flat();
    expect(new Set(all).size).toBe(all.length);
    expect(new Set(EXISTING_PAGE_PATHS.map(p => getVisualRouteGroup(p))).size).toBe(10);
  });

  it("covers nested and dynamic URLs without overriding navigation", () => {
    expect(getVisualRouteGroup("/crm/contatos")).toBe("crm");
    expect(getVisualRouteGroup("/companies/123")).toBe("crm");
    expect(getVisualRouteGroup("/report/completo")).toBe("workspace");
    expect(getVisualRouteGroup("/documents/generator")).toBe("documents");
    expect(getVisualRouteGroup("/settings/ops")).toBe("admin");
    expect(getVisualRouteGroup("/")).toBe("workspace");
    expect(getVisualRouteGroup("/future-new-route")).toBe("general");
  });
});

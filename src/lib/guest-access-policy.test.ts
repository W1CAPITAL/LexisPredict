import { describe, expect, it } from "vitest";
import { guestAccessDecision } from "./guest-access-policy";

describe("política de acesso do convidado", () => {
  it("permite somente prévia de navegação GET sem dados privados", () => {
    expect(guestAccessDecision("/cases", "GET", false)).toBe("preview");
    expect(guestAccessDecision("/processos", "GET", false)).toBe("preview");
  });

  it("não permite invocar endpoints privados com cookie de convidado", () => {
    expect(guestAccessDecision("/api/datajud-search", "GET", false)).toBe("blocked-api");
    expect(guestAccessDecision("/api/queue", "POST", false)).toBe("blocked-write");
  });

  it("bloqueia ações do servidor por POST mesmo em páginas visíveis", () => {
    expect(guestAccessDecision("/cases", "POST", false)).toBe("blocked-write");
    expect(guestAccessDecision("/processos", "DELETE", false)).toBe("blocked-write");
  });

  it("nega visualização de rotas administrativas e financeiras", () => {
    for (const route of ["/security", "/superadmin", "/ops", "/supervisao",
      "/auditoria", "/team", "/projetos", "/hermes-3d", "/settings",
      "/setup-empresa", "/primeiro-acesso", "/report/completo"]) {
      expect(guestAccessDecision(route, "GET", false)).toBe("blocked-page");
      expect(guestAccessDecision(route + "/qualquer", "GET", false)).toBe("blocked-page");
    }
  });

  it("não modifica autorização de endpoints que possuem política pública própria", () => {
    expect(guestAccessDecision("/api/health", "GET", true)).toBe("standard");
    expect(guestAccessDecision("/api/cron/wa-daily-return", "POST", true)).toBe("standard");
  });
});

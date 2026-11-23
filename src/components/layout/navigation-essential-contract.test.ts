import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = (file: string) => readFileSync(join(process.cwd(), file), "utf8");

describe("menus essenciais no desktop e no celular", () => {
  const vertical = source("src/components/layout/sidebar-vertical.tsx");
  const dock = source("src/components/layout/sidebar-dock.tsx");

  it("ambos os layouts partilham a mesma seleção de seis destinos", () => {
    expect(vertical).toContain("selectPrimaryNavigationItems([...mainItems, ...extraItems])");
    expect(dock).toContain("selectPrimaryNavigationItems(");
    expect(vertical).toContain("getPrimaryNavigationLabel(item.href, item.label)");
    expect(dock).toContain("getPrimaryNavigationLabel(item.href, item.label)");
  });

  it("mantém controle de acesso antes de mostrar o menu", () => {
    expect(vertical).toContain("filterNavByPlan(");
    expect(vertical).toContain("operatorRouteAllowed(item.href)");
    expect(dock).toContain("filterNavByPlan(");
    expect(dock).toContain("operatorRouteAllowed(item.href)");
    expect(dock).toContain("canViewCompanyCaseList(profile as any)");
  });

  it("preserva scanner e ferramentas especializadas sem destaque duplicado", () => {
    expect(vertical).toContain("onClick={handleOpenScanner}");
    expect(vertical).toContain("onClick={openToolsMenu}");
    expect(vertical).not.toContain("data-lexis-nav-footer-message");
    expect(vertical).not.toContain("data-lexis-mobile-menu-feature\"\n              className=\"mt-2");
  });
});

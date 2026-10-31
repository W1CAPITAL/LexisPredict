import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

describe("Sales CRM mobile regression contract", () => {
  const sidebar = source("src/components/layout/sidebar-vertical.tsx");
  const mobileCss = source("src/app/crm-mobile-refresh.css");
  const layout = source("src/app/layout.tsx");

  it("keeps the existing role/plan filtered navigation and scanner action", () => {
    expect(sidebar).toContain("filterNavByPlan(");
    expect(sidebar).toContain("operatorRouteAllowed(item.href)");
    expect(sidebar).toContain("canViewCompanyCaseList(profile as any)");
    expect(sidebar).toContain("onClick={handleOpenScanner}");
    expect(sidebar).toContain("onClick={() => navigateMobile(item.href)}");
    expect(sidebar).toContain('aria-label="Navegação principal móvel"');
  });

  it("offers only one mobile menu trigger flow, with accessible state", () => {
    expect(sidebar).not.toContain('aria-label="Abrir navegação flutuante"');
    expect(sidebar).toContain('id="lexis-mobile-menu"');
    expect(sidebar).toContain('aria-controls="lexis-mobile-menu"');
    expect(sidebar).toContain("aria-expanded={toolsOpen}");
    expect(sidebar).toContain('data-mobile-nav-active={active(item.href) ? "true" : "false"}');
    expect(sidebar).toContain('data-mobile-nav-pending={navigatingTo === item.href ? "true" : undefined}');
    expect(sidebar).toContain("setToolsOpen(false)");
  });

  it("does not fake notification or task counts", () => {
    expect(sidebar).not.toContain("showBadge");
    expect(sidebar).not.toContain('>12</span>');
    expect(sidebar).not.toContain('right-2 top-1.5 h-1.5 w-1.5 rounded-full bg-[#ff4d4f]');
  });

  it("applies a mobile-only visual layer with touch, safe areas and reduced-motion support", () => {
    expect(layout).toContain("import './crm-fluid-refresh.css';");
    expect(layout).toContain("import './crm-mobile-refresh.css';");
    expect(mobileCss).toContain("@media (max-width: 767px)");
    expect(mobileCss).toContain("[data-lexis-mobile-bottom-nav]");
    expect(mobileCss).toContain("[data-lexis-mobile-drawer]");
    expect(mobileCss).toContain("[data-lexis-mobile-menu-search]");
    expect(mobileCss).toContain("safe-area-inset-bottom");
    expect(mobileCss).toContain("prefers-reduced-motion: reduce");
    expect(mobileCss).toContain('data-lexis-motion="lite"');
    expect(mobileCss).not.toMatch(/animation:\s*[^;]*\binfinite\b/);
  });
});

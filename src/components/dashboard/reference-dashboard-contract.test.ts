import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

describe("Dashboard visual reference contract", () => {
  const overview = read("src/components/dashboard/dashboard-visual-overview.tsx");
  const home = read("src/app/page.tsx");
  const css = read("src/app/reference-dashboard.css");
  const crm = read("src/components/crm/crm-kanban.tsx");
  const crmShell = read("src/components/crm/crm-shell.tsx");
  const layout = read("src/app/layout.tsx");

  it("draws live portfolio numbers and historic attendance rather than demo data", () => {
    expect(home).toContain("<DashboardVisualOverview");
    expect(home).toContain("total={portfolioSummary?.total ?? null}");
    expect(home).toContain("ativos={portfolioSummary?.ativos ?? null}");
    expect(home).toContain("series={historicoEquipe?.dias?.map(");
    expect(overview).toContain("chartData.reduce(");
    expect(overview).toContain('dataKey="atendimentos"');
    expect(overview).toContain("Ainda não há histórico disponível");
    expect(overview).not.toContain("Math.random");
    expect(overview).not.toMatch(/(?:1,368|977|954|592|1,421,194)/);
  });

  it("keeps all original dashboard operational sections and paths", () => {
    expect(home).toContain("<EfferdPanel");
    expect(home).toContain("data-testid=\"merit-counters\"");
    expect(home).toContain("<BiCompliancePanel");
    expect(home).toContain('value="connectivity"');
    for (const path of ["/cases", "/tarefas", "/vencidos"]) {
      expect(overview).toContain(`href: "${path}"`);
    }
    expect(overview).toContain('href="/report"');
  });

  it("styles dark charcoal and lavender/orange light references without another route", () => {
    expect(layout).toContain("import './reference-dashboard.css'");
    expect(css).toContain("html.dark [data-lexis-reference-overview]");
    expect(css).toContain("html:not(.dark):not(.lexis-wallpaper-active)");
    expect(css).toContain("--lx-metric-bg:#f46d3c");
    expect(css).toContain("--lx-metric-bg:#d5fa78");
    expect(css).toContain("@media(max-width:767px)");
    expect(css).toContain("prefers-reduced-motion:reduce");
  });

  it("preserves real CRM Kanban events and accessible status navigation", () => {
    expect(crm).toContain('onClick={() => onSelect?.(n)}');
    expect(crm).toContain("onClick={() => prev && onMove(n.id, prev)}");
    expect(crm).toContain("onClick={() => next && onMove(n.id, next)}");
    expect(crm).toContain("data-stage={stage}");
    expect(crmShell).toContain('aria-current={active ? "page" : undefined}');
    expect(crmShell).toContain('aria-label="Seções do CRM"');
  });
});

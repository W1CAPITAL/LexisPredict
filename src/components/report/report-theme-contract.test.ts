import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

describe("Reports theme follows app appearance instead of a fixed AI palette", () => {
  const css = source("src/app/report-complete-theme.css");
  const report = source("src/app/report/page.tsx");
  const complete = source("src/app/report/completo/page.tsx");
  const executive = source("src/components/report/report-executive-dashboard.tsx");
  const smart = source("src/components/report/report-smart-overview.tsx");
  const team = source("src/components/report/team-report.tsx");
  const layout = source("src/app/layout.tsx");

  it("uses existing theme tokens for both light and dark, including custom primary colors", () => {
    expect(layout).toContain("import './report-complete-theme.css';");
    expect(css).toContain("--lx-report-canvas: hsl(var(--background));");
    expect(css).toContain("--lx-report-paper: hsl(var(--card));");
    expect(css).toContain("--lx-report-ink: hsl(var(--foreground));");
    expect(css).toContain("--lx-report-accent: hsl(var(--primary));");
    expect(css).toContain("html.dark .report-completo-shell");
    expect(css).toContain("var(--lx-report-accent)");
    expect(css).toContain("@media print");
    expect(css).not.toContain("#080f1e");
    expect(css).not.toContain("#7048dc");
    expect(css).not.toContain("#8b5cf6");
  });

  it("renders existing real-data report and detail screens with the same theme", () => {
    expect(report).toContain('data-lexis-report-page="executive"');
    expect(complete).toContain('data-lexis-report-page="complete"');
    expect(report).toContain("<ReportExecutiveDashboard");
    expect(report).toContain("<ReportSmartOverview");
    expect(report).toContain("<TeamReport");
    expect(complete).toContain("<OmniReportStudio");
    expect(complete).toContain("<ReportPdfExportButton");
    expect(report).toContain("lexis_portfolio_snapshot");
    expect(report).toContain("getReportAccess(");
  });

  it("removes black/purple from executive cards, filter pills, charts and analytics", () => {
    expect(executive).toContain("data-lexis-report-executive");
    expect(executive).toContain('data-report-stat={tone}');
    expect(executive).toContain('stroke="var(--lx-report-chart-1)"');
    expect(executive).toContain('stroke="var(--lx-report-chart-2)"');
    expect(executive).toContain("var(--lx-report-paper)");
    expect(executive).toContain('aria-current={p.periodo===x.id?"page":undefined}');
    expect(executive).toContain("<ReportPdfExportButton");
    expect(executive).toContain('onChange={e=>setSelected(e.target.value)}');
    expect(executive).not.toMatch(/\b(?:violet|indigo|fuchsia)-(?:[0-9]|950)/);
    expect(smart).toContain("data-lexis-report-smart");
    expect(smart).toContain('className="bg-primary"');
    expect(smart).not.toContain("bg-gradient-to-br from-indigo");
    expect(team).toContain("bg-primary");
  });

  it("keeps PDF legible and animations optional", () => {
    expect(css).toContain("prefers-reduced-motion:reduce");
    expect(css).toContain(".report-completo-shell .lexis-report-band");
    expect(css).toContain("background:#fff !important");
    expect(css).toContain("color:#111 !important");
    expect(complete).toContain("handlePrint");
    expect(complete).toContain("handleDownloadPdf");
  });
});

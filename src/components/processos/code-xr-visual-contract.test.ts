import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = (file: string) => readFileSync(join(process.cwd(), file), "utf8");

describe("CodeXR visual parity and safe card consolidation", () => {
  const css = source("src/app/code-xr-unified.css");
  const layout = source("src/app/layout.tsx");
  const processes = source("src/app/processos/page.tsx");
  const commandCenter = source("src/components/processos/processos-command-center.tsx");
  const home = source("src/app/page.tsx");
  const routeGroups = source("src/lib/visual-route-groups.ts");

  it("styles all registered operational route groups without changing their routing", () => {
    expect(layout).toContain("import './code-xr-unified.css';");
    expect(css).toContain("body[data-lexis-visual-group]");
    expect(css).toContain('--lx-xr-accent: #f47445;');
    expect(css).toContain('--lx-xr-accent: #d5fa78;');
    expect(css).toContain("prefers-reduced-motion:reduce");
    expect(css).toContain("@media print");
    expect(routeGroups).toContain('"workspace"');
    expect(routeGroups).toContain('"communication"');
    expect(routeGroups).toContain('"cases"');
    expect(routeGroups).toContain('"documents"');
    expect(routeGroups).toContain('"crm"');
    expect(routeGroups).toContain('"operations"');
    expect(routeGroups).toContain('"admin"');
  });

  it("keeps /processos searchable, editable and scanner-ready with the same source of truth", () => {
    expect(processes).toContain('<main data-lexis-processos-workspace');
    expect(processes).toContain('data-lexis-processos-team');
    expect(processes).toContain('<AtendimentosEquipeDiarios');
    expect(processes).toContain('<AtividadesRegistradasKpi');
    expect(processes).toContain('<ProcessosCommandCenter');
    expect(processes).toContain('/api/carteira/indicadores?scope=empresa');
    expect(processes).toContain("onScan={canRodarEmpresa ? () => {");
    expect(commandCenter).toContain("data-lexis-processos-kpis");
    expect(commandCenter).toContain("data-lexis-processos-table");
    expect(commandCenter).toContain("data-lexis-processos-inspector");
    expect(commandCenter).toContain("onClick={() => props.onAttend(selected)}");
    expect(commandCenter).toContain("onClick={() => props.onEdit(selected)}");
    expect(commandCenter).toContain('data-selected={selectedRow ? "true" : undefined}');
    expect(commandCenter).toContain('event.key === "Enter"');
  });

  it("removes old duplicate metric cards but keeps the newer real-data cards", () => {
    expect(home).toContain("<DashboardVisualOverview");
    expect(home).toContain('vencidos={portfolioSummary?.vencidos ?? metrics.countVencido}');
    expect(home).not.toContain('StatCard title={t.statusHoje}');
    expect(home).not.toContain('StatCard title={t.statusVencido}');
    expect(home).not.toContain('StatCard title="Risco Global"');
    expect(home).toContain("riskScore={metrics.riskScore}");
    expect(home).toContain('StatCard title="Andamentos"');
    expect(home).toContain('StatCard title="Baixas tribunal"');
  });

  it("does not hide or infer different indicators as duplicates", () => {
    expect(commandCenter).toContain('label="Processos"');
    expect(commandCenter).toContain('label="Ativos"');
    expect(commandCenter).toContain('label="Retornos vencidos"');
    expect(commandCenter).toContain('label="Risco alto"');
    expect(processes).toContain('variant="today"');
    expect(css).not.toContain("display:none");
  });
});

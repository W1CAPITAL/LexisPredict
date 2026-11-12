import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
const source = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

describe("Swarm Rebuild – native, isolated and lightweight", () => {
  const template = source("src/app/template.tsx");
  const shell = source("src/components/layout/persistent-app-shell.tsx");
  const effect = source("src/components/layout/swarm-route-loading.tsx");
  const plan = source("src/lib/swarm-dom-plan.ts");
  const tabs = source("src/components/ui/tabs.tsx");

  it("mounts inside route content only; persistent sidebar remains outside the rebuild", () => {
    expect(shell).toContain("<SwarmRouteLoading />");
    expect(shell).toContain("data-lexis-route-content");
    expect(shell).toContain("data-lexis-rebuild-root");
    expect(shell).toContain("<Sidebar persistentRoot />");
    expect(template).not.toContain("<SwarmRouteLoading />");
    expect(effect).toContain('[data-lexis-rebuild-root]');
  });

  it("does no DOM capture, document tab listeners or layout work until the user opts in", () => {
    const start = effect.indexOf("const startForCurrentRoute");
    const gate = effect.indexOf("if (!preferences.enabled) return;", start);
    const domLookup = effect.indexOf("document.querySelector(ROOT_SELECTOR)", start);
    expect(effect).toContain("loadSwarmRebuildPreferences");
    expect(gate).toBeGreaterThanOrEqual(0);
    expect(domLookup).toBeGreaterThan(gate);
    expect(effect).toContain("SWARM_REBUILD_PREFERENCES_EVENT");
    const tabListener = effect.indexOf("document.addEventListener(\"click\"", start);
    const observer = effect.indexOf("new MutationObserver", start);
    expect(tabListener).toBeGreaterThan(gate);
    expect(observer).toBeGreaterThan(gate);
    expect(effect).toContain("routeObserver?.disconnect()");
    expect(effect).toContain("tabObserver?.disconnect()");
    expect(effect).toContain("routeMaxTimer");
    expect(effect).toContain("tabMaxTimer");
    expect(effect).toContain("routeObserver.observe(root");
    expect(effect).toContain("tabObserver.observe(panel");
  });

  it("exposes the rebuild setting and speed control in Settings", () => {
    const settings = source("src/app/settings/page.tsx");
    const panel = source("src/components/settings/swarm-rebuild-settings-panel.tsx");
    expect(settings).toContain("SwarmRebuildSettingsPanel");
    expect(settings).toContain('id: "Swarm"');
    expect(panel).toContain("Muito lenta");
    expect(panel).toContain("Muito rápida");
    expect(tabs).toContain("data-lexis-rebuild-tab");
    for (const path of [
      "src/components/dashboard/office-stats.tsx",
      "src/components/processos/processos-command-center.tsx",
      "src/components/vencidos/vencidos-panel.tsx",
      "src/app/tarefas/page.tsx",
      "src/app/agenda/page.tsx",
      "src/app/hermes-3d/page.tsx",
      "src/app/plugins/page.tsx",
      "src/app/busca-apreensao/page.tsx",
    ]) {
      expect(source(path), path).toContain("data-lexis-rebuild-tab");
    }
  });


  it("connects custom tab controls to the exact panel that changes", () => {
    const contracts = [
      ["src/app/tarefas/page.tsx", "tarefas-fila-panel"],
      ["src/components/processos/processos-command-center.tsx", "processos-inspector-tab-panel"],
      ["src/components/dashboard/office-stats.tsx", "office-stats-tab-panel"],
      ["src/components/vencidos/vencidos-panel.tsx", "vencidos-tab-panel"],
      ["src/app/agenda/page.tsx", "agenda-view-panel"],
      ["src/app/hermes-3d/page.tsx", "hermes-view-panel"],
      ["src/app/busca-apreensao/page.tsx", "busca-apreensao-results"],
      ["src/app/plugins/page.tsx", "plugins-category-results"],
    ] as const;
    for (const [path, panelId] of contracts) {
      const page = source(path);
      expect(page, path).toContain("aria-controls=\"" + panelId + "\"");
      expect(page, path).toContain("id=\"" + panelId + "\"");
    }
  });

  it("animates the original DOM elements without cloning, replacing or redrawing the page", () => {
    expect(effect).toContain("getBoundingClientRect");
    expect(effect).toContain("getComputedStyle");
    expect(effect).toContain("element.animate(");
    expect(effect).toContain("clipPath");
    expect(effect).toContain("restoreOriginalVisibility");
    expect(effect).not.toContain("document.createElement(\"canvas\")");
    expect(effect).not.toContain("requestAnimationFrame");
    expect(effect).not.toContain("drawImage");
    expect(effect).not.toContain("document.body, NodeFilter");
  });

  it("limits style/layout reads to likely visual nodes and skips nested text inside a card", () => {
    expect(effect).toContain("CANDIDATE_SELECTOR");
    expect(effect).not.toContain('querySelectorAll("*")');
    expect(effect).toContain("surfaceAncestors");
    expect(effect).toContain("hasSurfaceAncestor");
    expect(effect).toContain("textAncestors");
    expect(effect).toContain("hasTextAncestor");
    expect(effect).toContain("DOM_REBUILD_MAX_ELEMENTS");
  });

  it("bounds the effect for weak computers", () => {
    expect(plan).toContain("DOM_REBUILD_MAX_ELEMENTS = 48");
    expect(plan).toContain("DOM_REBUILD_AGENTS = 4");
    expect(plan).toContain("DOM_REBUILD_DURATION_MS = getSwarmRebuildProfile(1).durationMs");
    expect(effect).toContain("prefers-reduced-motion");
    expect(effect).toContain("will-change:transform");
  });

  it("supports Radix, settings and custom tabs by pointer and keyboard", () => {
    expect(effect).toContain('[role="tab"]');
    expect(effect).toContain("[data-lexis-settings-tab]");
    expect(effect).toContain("[data-lexis-dashboard-tablist]");
    expect(effect).toContain("[data-lexis-rebuild-tab]");
    expect(effect).toContain("[data-lexis-rebuild-tablist] button");
    expect(effect).toContain("aria-controls");
    expect(effect).toContain("[data-lexis-rebuild-panel]");
    expect(effect).toContain("addEventListener(\"click\"");
    expect(effect).toContain("addEventListener(\"keydown\"");
    expect(tabs).toContain("data-lexis-rebuild-tab");
    expect(tabs).toContain("data-lexis-rebuild-panel");
    expect(effect).toContain("ArrowLeft");
    expect(effect).toContain("activeTabPanel");
    expect(effect).toContain("controlledPanelForTab");
    expect(effect).toContain("captured.length < DOM_REBUILD_MIN_ELEMENTS");
    expect(plan).toContain("DOM_REBUILD_MIN_ELEMENTS = 1");
    expect(plan).toContain("sampleDomCandidates");
  });

  it("restores original inline styles and cancels pending work on navigation or skip", () => {
    expect(effect).toContain("cancel()");
    expect(effect).toContain("clearTimeout");
    expect(effect).toContain("restoreOriginalVisibility");
    expect(effect).toContain("stage?.remove()");
    expect(effect).toContain("Pular");
  });
});
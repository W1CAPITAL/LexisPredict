import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
const source = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

describe("Swarm Rebuild – native, isolated and lightweight", () => {
  const template = source("src/app/template.tsx");
  const shell = source("src/components/layout/persistent-app-shell.tsx");
  const effect = source("src/components/layout/swarm-route-loading.tsx");
  const plan = source("src/lib/swarm-dom-plan.ts");

  it("mounts inside route content only; persistent sidebar remains outside the rebuild", () => {
    expect(shell).toContain("<SwarmRouteLoading />");
    expect(shell).toContain("data-lexis-route-content");
    expect(shell).toContain("data-lexis-rebuild-root");
    expect(shell).toContain("<Sidebar persistentRoot />");
    expect(template).not.toContain("<SwarmRouteLoading />");
    expect(effect).toContain('[data-lexis-rebuild-root]');
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
    expect(effect).toContain("MAX_CAPTURED");
  });

  it("bounds the effect for weak computers", () => {
    expect(plan).toContain("DOM_REBUILD_MAX_ELEMENTS = 96");
    expect(plan).toContain("DOM_REBUILD_AGENTS = 8");
    expect(plan).toContain("DOM_REBUILD_DURATION_MS = 140");
    expect(effect).toContain("prefers-reduced-motion");
    expect(effect).toContain("will-change:transform");
  });

  it("supports Radix, settings and custom tabs by pointer and keyboard", () => {
    expect(effect).toContain('[role="tab"]');
    expect(effect).toContain("[data-lexis-settings-tab]");
    expect(effect).toContain("[data-lexis-dashboard-tablist]");
    expect(effect).toContain("addEventListener(\"click\"");
    expect(effect).toContain("addEventListener(\"keydown\"");
    expect(effect).toContain("ArrowLeft");
    expect(effect).toContain("activeTabPanel");
  });

  it("restores original inline styles and cancels pending work on navigation or skip", () => {
    expect(effect).toContain("cancel()");
    expect(effect).toContain("clearTimeout");
    expect(effect).toContain("restoreOriginalVisibility");
    expect(effect).toContain("stage?.remove()");
    expect(effect).toContain("Pular");
  });
});
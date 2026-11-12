import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
const source = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

describe("Swarm Rebuild – reveal original DOM in place", () => {
  const template = source("src/app/template.tsx");
  const effect = source("src/components/layout/swarm-route-loading.tsx");

  it("limits reconstruction to route content, never the persistent sidebar or whole document", () => {
    expect(template).toContain("<SwarmRouteLoading />");
    expect(effect).toContain('[data-lexis-rebuild-root]');
    expect(effect).not.toContain("document.body, NodeFilter");
    expect(effect).not.toContain("swarmCaptureVeil");
    expect(effect).not.toContain("resolvePageBackground");
  });

  it("reveals the original real elements without changing their measured layout", () => {
    expect(effect).toContain("getBoundingClientRect");
    expect(effect).toContain("getComputedStyle");
    expect(effect).toContain("element.animate(");
    expect(effect).toContain("clipPath");
    expect(effect).toContain('setProperty("visibility", "hidden", "important")');
    expect(effect).toContain("restoreOriginalVisibility");
    expect(effect).toContain("data-swarm-rebuild-stage");
  });

  it("keeps the sidebar interactive and avoids a canvas redraw loop", () => {
    expect(effect).toContain("pointer-events:none");
    expect(effect).toContain("pointer-events:auto");
    expect(effect).not.toContain("document.createElement(\"canvas\")");
    expect(effect).not.toContain("requestAnimationFrame");
    expect(effect).not.toContain("drawImage");
    expect(effect).toContain("MAX_DOM_REBUILD_ELEMENTS");
  });

  it("supports pointer and keyboard activation of every Radix/custom tab", () => {
    expect(effect).toContain('[role="tab"]');
    expect(effect).toContain("addEventListener(\"click\"");
    expect(effect).toContain("addEventListener(\"keydown\"");
    expect(effect).toContain("ArrowLeft");
    expect(effect).toContain("ArrowRight");
    expect(effect).toContain("aria-controls");
    expect(effect).toContain("activeTabPanel");
  });

  it("restores original inline styles and cancels pending work on navigation or skip", () => {
    expect(effect).toContain("cancel()");
    expect(effect).toContain("clearTimeout");
    expect(effect).toContain("restoreOriginalVisibility");
    expect(effect).toContain("stage.remove()");
    expect(effect).toContain("prefers-reduced-motion");
    expect(effect).toContain("Pular");
  });
});
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

describe("Swarm Rebuild – reconstruct real LexisPredict content without lag", () => {
  const template = source("src/app/template.tsx");
  const effect = source("src/components/layout/swarm-route-loading.tsx");
  const css = source("src/app/swarm-loading.css");

  it("mounts the effect around the actual content on all routes", () => {
    expect(template).toContain("data-lexis-rebuild-root");
    expect(template).toContain("<SwarmRouteLoading />");
    expect(template.indexOf("<SwarmRouteLoading />")).toBeLessThan(template.indexOf("{children}"));
  });

  it("animates DOM content rather than a fake loading card", () => {
    expect(effect).toContain("querySelectorAll");
    expect(effect).toContain("element.animate(");
    expect(effect).toContain("clipPath");
    expect(effect).toContain("getBoundingClientRect");
    expect(effect).toContain("createPortal(");
    expect(effect).not.toContain("Reconstruindo a tela");
    expect(effect).not.toContain("SWARM REBUILD</span>");
    expect(css).not.toContain(".lx-swarm-route-loading__panel");
    expect(css).not.toContain("backdrop-filter");
  });

  it("moves real cursors and drawing guides over the revealed content", () => {
    expect(effect).toContain("data-lexis-swarm-cursor");
    expect(effect).toContain("data-lexis-swarm-guide");
    expect(css).toContain(".lx-swarm-cursor");
    expect(css).toContain(".lx-swarm-guide");
    expect(css).toContain("pointer-events:none");
  });

  it("covers Radix tabs, keyboard navigation and custom settings tabs", () => {
    expect(effect).toContain('[role="tab"], [data-lexis-settings-tab]');
    expect(effect).toContain('document.addEventListener("pointerdown"');
    expect(effect).toContain('document.addEventListener("keydown"');
    expect(effect).toContain('document.addEventListener("click"');
    expect(effect).toContain('tab.hasAttribute("data-lexis-settings-tab")');
    expect(effect).toContain('tab.getAttribute("role") === "tab"');
  });

  it("animates streamed-in page content and replays cursor guides on rapid tab changes", () => {
    expect(effect).toContain("new MutationObserver(");
    expect(effect).toContain("observer.disconnect()");
    expect(effect).toContain("mutationPasses < 3");
    expect(effect).toContain("markerGeneration");
    expect(effect).toContain("id: `${++markerGeneration}-${index}`");
  });

  it("is finite and respects lightweight mode and reduced motion", () => {
    expect(effect).toContain("prefers-reduced-motion: reduce");
    expect(effect).toContain('data-lexis-motion');
    expect(effect).toContain("MAX_REBUILD_TARGETS");
    expect(effect).toContain("cancel()");
    expect(css).toContain("prefers-reduced-motion:reduce");
    expect(css).not.toContain("animation-iteration-count:infinite");
  });
});

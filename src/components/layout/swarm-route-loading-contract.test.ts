import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

describe("Swarm loading across LexisPredict tabs", () => {
  const template = source("src/app/template.tsx");
  const loader = source("src/components/layout/swarm-route-loading.tsx");
  const styles = source("src/app/swarm-loading.css");
  const layout = source("src/app/layout.tsx");

  it("mounts the shared swarm transition in the root route template", () => {
    expect(template).toContain("SwarmRouteLoading");
    expect(template).toContain("<SwarmRouteLoading />");
    expect(template.indexOf("<SwarmRouteLoading />")).toBeLessThan(template.indexOf("{children}"));
  });

  it("shows an accessible loading state and replays on route and local-tab changes", () => {
    expect(loader).toContain('data-lexis-route-loading');
    expect(loader).toContain('role="status"');
    expect(loader).toContain('aria-busy="true"');
    expect(loader).toContain("<SwarmLoadingIndicator");
    expect(loader).toContain('document.addEventListener("click"');
    expect(loader).toContain('[role="tab"]');
    expect(loader).toContain("setVisible(true)");
    expect(loader).toContain("setVisible(false)");
    expect(loader).toContain("window.setTimeout");
  });

  it("keeps the animation lightweight, non-blocking and motion-accessible", () => {
    expect(styles).toContain(".lx-swarm-route-loading");
    expect(styles).toContain("pointer-events:none");
    expect(styles).toContain("prefers-reduced-motion:reduce");
    expect(styles).toContain('data-lexis-motion="lite"');
    expect(styles).toContain("@keyframes lx-swarm-route-progress");
  });

  it("keeps the shared loader stylesheet globally available", () => {
    expect(layout).toContain("import './swarm-loading.css';");
  });
});

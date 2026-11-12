import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
const source = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

describe("Swarm Rebuild – original blueprint behavior, not fade-in decoration", () => {
  const template = source("src/app/template.tsx");
  const effect = source("src/components/layout/swarm-route-loading.tsx");

  it("runs within every route and observes in-page tabs", () => {
    expect(template).toContain("<SwarmRouteLoading />");
    expect(effect).toContain("usePathname");
    expect(effect).toContain("seenRebuildRoutes");
    expect(effect).toContain("seenRebuildTabs");
    expect(effect).toContain('document.addEventListener("pointerdown"');
  });

  it("captures real shapes, text and media into a drawn blueprint", () => {
    expect(effect).toContain("createTreeWalker");
    expect(effect).toContain("NodeFilter.SHOW_TEXT");
    expect(effect).toContain("getBoundingClientRect");
    expect(effect).toContain("getComputedStyle");
    expect(effect).toContain("planSwarmStoryboard");
    expect(effect).toContain("kind: \"text\"");
    expect(effect).toContain("kind: \"box\"");
    expect(effect).toContain("kind: \"media\"");
  });

  it("rebuilds the captured page with strokes, typed text, source images and moving agents", () => {
    expect(effect).toContain("document.createElement(\"canvas\")");
    expect(effect).toContain("CanvasRenderingContext2D");
    expect(effect).toContain("fillText");
    expect(effect).toContain("drawImage");
    expect(effect).toContain("drawCursor");
    expect(effect).toContain("requestAnimationFrame");
    expect(effect).not.toContain("element.animate(");
    expect(effect).not.toContain("Reconstruindo a tela");
  });

  it("leaves actual application data unchanged and cleans up after completion or navigation", () => {
    expect(effect).toContain("cancelAnimationFrame");
    expect(effect).toContain("document.body.appendChild");
    expect(effect).toContain("stage.remove()");
    expect(effect).toContain("prefers-reduced-motion");
    expect(effect).not.toContain("syncRepoCases");
  });
});
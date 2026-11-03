import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

describe("Video reference motion and persistent navigation", () => {
  const vertical = source("src/components/layout/sidebar-vertical.tsx");
  const css = source("src/app/video-fluid-navigation.css");
  const layout = source("src/app/layout.tsx");

  it("keeps one persistent sidebar and shared animation stylesheet", () => {
    expect(source("src/components/layout/persistent-app-shell.tsx")).toContain("<Sidebar persistentRoot />");
    expect(layout).toContain("import './video-fluid-navigation.css';");
    expect(layout.indexOf("import './video-fluid-navigation.css';")).toBeGreaterThan(layout.indexOf("import './codeandchill-motion.css';"));
  });

  it("starts collapsed deterministically and only expands the fixed desktop rail", () => {
    expect(vertical).toContain("const [railCollapsed, setRailCollapsed] = useState(true)");
    expect(vertical).not.toContain("lexis-sidebar-rail-collapsed");
    expect(vertical).toContain('navBehavior === "fixed" && railCollapsed');
    expect(vertical).toContain('if (navBehavior === "fixed") setRailCollapsed(false)');
    expect(vertical).toContain("aria-expanded={!railCollapsed}");
    expect(vertical).toContain('aria-controls="lexis-desktop-navigation"');
    expect(css).toContain('data-lexis-sidebar-behavior="fixed"');
    expect(css).toContain('data-lexis-rail="true"');
    expect(css).toContain("width:var(--lx-video-sidebar-compact) !important");
    expect(css).toContain("transition: width var(--lx-video-sidebar-duration)");
  });

  it("expands on hover, any sidebar click or keyboard focus, and closes outside or on Escape", () => {
    expect(vertical).toContain("ref={sidebarRef}");
    expect(vertical).toContain("onMouseEnter={expandRail}");
    expect(vertical).toContain("onClickCapture={expandRail}");
    expect(vertical).toContain("onFocusCapture={expandRail}");
    expect(vertical).toContain('document.addEventListener("pointerdown", collapseOnOutsidePointer, true)');
    expect(vertical).toContain('sidebarRef.current?.contains(event.target as Node)');
    expect(vertical).toContain("setRailCollapsed(true)");
    expect(vertical).toContain('event.key === "Escape"');
    expect(vertical).toContain('document.removeEventListener("pointerdown", collapseOnOutsidePointer, true)');
    expect(vertical).toContain('document.removeEventListener("keydown", collapseOnEscape)');
    expect(vertical).toContain('onClick={expandRail}');
    expect(vertical).not.toContain("event.preventDefault()");
  });

  it("animates one real active pill and honors mobile/low motion", () => {
    expect(vertical).toContain("const desktopActiveIndex = primaryItems.findIndex");
    expect(vertical).toContain('"--lx-active-index"');
    expect(css).toContain('data-lexis-active-visible="true"');
    expect(css).toContain('translate3d(0,calc(var(--lx-active-index)');
    expect(css).toContain("prefers-reduced-motion:reduce");
    expect(css).toContain('data-lexis-motion="lite"');
    expect(css).toContain("[data-lexis-mobile-drawer]");
    expect(css).not.toMatch(/animation:\s*[^;]*\binfinite\b/);
  });

  it("retains real navigation and security operations", () => {
    expect(vertical).toContain("filterNavByPlan(");
    expect(vertical).toContain("operatorRouteAllowed(item.href)");
    expect(vertical).toContain("onClick={handleOpenScanner}");
    expect(vertical).toContain("onClick={() => void signOut()}");
  });
});

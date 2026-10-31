import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

describe("Code & Chill navigation / authentication visual contract", () => {
  const css = read("src/app/codeandchill-motion.css");
  const layout = read("src/app/layout.tsx");
  const login = read("src/app/login/page.tsx");
  const signup = read("src/app/signup/page.tsx");
  const vertical = read("src/components/layout/sidebar-vertical.tsx");
  const dock = read("src/components/layout/sidebar-dock.tsx");
  const shell = read("src/components/layout/persistent-app-shell.tsx");

  it("loads a single consistent motion theme after the previous UI styles", () => {
    const previous = layout.indexOf("import './code-xr-unified.css';");
    const current = layout.indexOf("import './codeandchill-motion.css';");
    expect(previous).toBeGreaterThan(-1);
    expect(current).toBeGreaterThan(previous);
    expect(css).toContain("prefers-reduced-motion:reduce");
    expect(css).toContain('data-lexis-motion="lite"');
    expect(css).toContain("color-scheme:light");
    expect(css).not.toMatch(/animation:\s*[^;]*\binfinite\b/);
  });

  it("changes only the design of real login and registration, not endpoints or security flows", () => {
    expect(login).toContain('data-lexis-auth-screen="login"');
    expect(signup).toContain('data-lexis-auth-screen="signup"');
    expect(login).toContain('data-lexis-auth-submit');
    expect(login).toContain('data-lexis-auth-aside');
    expect(signup).toContain('data-lexis-auth-aside');
    expect(login).toContain('onSubmit={handleLogin}');
    expect(login).toContain('fetch("/api/auth/login"');
    expect(login).toContain('await trySafety(');
    expect(login).toContain('onClick={() => void enterGuest()}');
    expect(login).toContain('href="/signup"');
    expect(signup).toContain('href="/login"');
    expect(signup).toContain('createCommercialAccountAction(');
    expect(signup).toContain('provisionMinhaEmpresaAction(');
    expect(css).toContain('clip-path:polygon(');
  });

  it("animates one real mobile destination indicator without introducing a second menu", () => {
    expect(vertical).toContain("const mobileActiveIndex = toolsOpen ? 4");
    expect(vertical).toContain("data-lexis-mobile-active-index={mobileActiveIndex}");
    expect(vertical).toContain('data-mobile-nav-active={isCurrentMobile ? "true" : "false"}');
    expect(vertical).toContain("onClick={handleOpenScanner}");
    expect(vertical).toContain("onClick={openToolsMenu}");
    expect(vertical).toContain("filterNavByPlan(");
    expect(vertical).toContain("operatorRouteAllowed(item.href)");
    expect(vertical).toContain('aria-label="Navegação principal móvel"');
    expect(css).toContain('[data-lexis-mobile-bottom-nav]::before');
    expect(css).toContain('data-lexis-mobile-active-index="4"');
    expect(css).toContain("touch");
  });

  it("retains persistent desktop sidebar, dock layout preference and accessible fallback", () => {
    expect(dock).toContain("data-lexis-magnetic-dock");
    expect(vertical).toContain("data-lexis-magnetic-sidebar");
    expect(shell).toContain("<Sidebar persistentRoot />");
    expect(vertical).toContain("aria-current={isActive?'page':undefined}");
    expect(dock).toContain("aria-current={active?'page':undefined}");
    expect(css).toContain("focus-visible");
    expect(css).toContain("@media print");
    expect(css).not.toContain("pointer-events:none !important");
  });
});

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
const source = (p: string) => readFileSync(join(process.cwd(), p), "utf8");
describe("unified wine workspace contract", () => {
  it("loads final wine style across the shared shell", () => {
    const layout = source("src/app/layout.tsx");
    expect(layout.indexOf("import './w1-unified-wine.css'")).toBeGreaterThan(layout.indexOf("import './swarm-loading.css'"));
    expect(source("src/components/layout/persistent-app-shell.tsx")).toContain('data-lexis-design="wine-operations"');
  });
  it("supports mobile, tablet, desktop, 4K and user zoom", () => {
    const css = source("src/app/w1-unified-wine.css");
    for (const b of ["max-width: 359px","max-width: 767px","max-width: 1199px","max-width: 1559px","min-width: 1920px"]) expect(css).toContain(b);
    const layout = source("src/app/layout.tsx");
    expect(layout).not.toContain("userScalable: false");
    expect(layout).not.toContain("maximumScale: 1");
  });
  it("preserves access to core and secondary destinations in dock mode", () => {
    const dock = source("src/components/layout/sidebar-dock.tsx");
    for (const href of ["/tarefas","/vencidos","/cases","/processos","/whatsapp","/settings","/agenda","/crm","/report"]) expect(dock).toContain(href);
  });
});

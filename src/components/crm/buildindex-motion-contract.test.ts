import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { indexCrmStages, findConfirmedCrmMoves } from "@/lib/crm-stage-motion";

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

describe("BuildIndex-style real data motion contract", () => {
  it("does not pretend a deal moved on initial load or after an unchanged refresh", () => {
    const initial = indexCrmStages({ lead: [{ id: "1" }], proposta: [{ id: "2" }] });
    expect(findConfirmedCrmMoves(null, initial)).toEqual([]);
    expect(findConfirmedCrmMoves(initial, indexCrmStages({
      proposta: [{ id: "2" }],
      lead: [{ id: "1" }],
    }))).toEqual([]);
  });

  it("animates only an actual stage transition, not created or deleted records", () => {
    const before = indexCrmStages({
      lead: [{ id: "1" }, { id: "2" }],
      proposta: [{ id: "3" }],
    });
    const after = indexCrmStages({
      lead: [{ id: "2" }, { id: "4" }],
      proposta: [{ id: "1" }],
    });
    expect(findConfirmedCrmMoves(before, after)).toEqual(["1"]);
  });

  it("preserves CRM permissions/actions and shows pending only for real busyId", () => {
    const crm = read("src/components/crm/crm-kanban.tsx");
    expect(crm).toContain("findConfirmedCrmMoves(");
    expect(crm).toContain('aria-busy={busyId === n.id}');
    expect(crm).toContain('busyId === n.id ? "true" : undefined');
    expect(crm).toContain('onClick={() => onSelect?.(n)}');
    expect(crm).toContain('onClick={() => prev && onMove(n.id, prev)}');
    expect(crm).toContain('onClick={() => next && onMove(n.id, next)}');
    expect(crm).toContain('role="status" aria-live="polite"');
  });

  it("adds keyboard navigation to the existing desktop command palette, not another one", () => {
    const palette = read("src/components/sf-chrome/lexis-command-palette.tsx");
    const client = read("src/components/system/client-chrome.tsx");
    expect(palette).toContain('event.key === "ArrowDown"');
    expect(palette).toContain('event.key === "ArrowUp"');
    expect(palette).toContain('event.key === "Enter"');
    expect(palette).toContain('aria-activedescendant={filtered.length');
    expect(palette).toContain('role="listbox"');
    expect(palette).toContain('role="option"');
    expect(palette).toContain("router.push(href)");
    expect(palette).toContain('e.key.toLowerCase() === "k"');
    expect(client).toContain("<LexisCommandPalette />");
  });

  it("scopes motion to task cards and app shell and honors low-end preferences", () => {
    const layout = read("src/app/layout.tsx");
    const css = read("src/app/buildindex-motion.css");
    const tasks = read("src/app/tarefas/page.tsx");
    const dashboard = read("src/components/dashboard/dashboard-visual-overview.tsx");
    expect(layout).toContain("import './buildindex-motion.css';");
    expect(css).toContain('data-lexis-buildindex-arrival="true"');
    expect(css).toContain('data-lexis-motion="lite"');
    expect(css).toContain("prefers-reduced-motion:reduce");
    expect(css).toContain("@media print");
    expect(css).not.toMatch(/animation:\s*[^;]*\binfinite\b/);
    expect(tasks).toContain('data-lexis-buildindex-task-card');
    expect(tasks).toContain('data-task-urgency={group.hasBA ? "ba"');
    expect(dashboard).toContain('data-lexis-reference-overview');
  });
});

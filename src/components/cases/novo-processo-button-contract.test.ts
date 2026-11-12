import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

describe("New process creation from the portfolio and task queue", () => {
  const button = source("src/components/cases/novo-processo-button.tsx");
  const action = source("src/app/actions/case-save-actions.ts");
  const queue = source("src/components/returns/company-due-queue.tsx");
  const page = source("src/app/processos/page.tsx");
  const command = source("src/components/processos/processos-command-center.tsx");

  it("uses a create-only server action and refreshes after a confirmed insert", () => {
    expect(button).toContain("createOneCaseAction");
    expect(button).toContain("onCreated");
    expect(button).toContain("await onCreated?.()");
    expect(action).toContain("createOneCaseAction");
    expect(action).toContain("__create_only");
    expect(action).toContain("Processo já cadastrado");
  });

  it("adds the create action to the company-wide /tarefas queue", () => {
    expect(queue).toContain("NovoProcessoButton");
    expect(queue).toContain("onCreated");
  });

  it("adds the create action to the /processos command center", () => {
    expect(page).toContain("onCreateProcess");
    expect(command).toContain("NovoProcessoButton");
    expect(command).toContain("onCreateProcess");
  });

  it("does not replace a partial page or due queue with a client-side full-list sync", () => {
    expect(button).not.toContain("syncRepoCases");
    expect(button).not.toContain("setCases(next)");
  });
});

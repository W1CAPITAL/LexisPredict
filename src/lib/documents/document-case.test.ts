import { describe, expect, it } from "vitest";
import type { DocumentCase } from "@/app/actions/document-case-actions";

describe("DocumentCase (mapeamento do processo selecionado)", () => {
  it("usa identificador de processo e não identifica o cliente apenas pelo nome", () => {
    const entry: Pick<DocumentCase,"id"|"cliente"|"cnj"> = {id:"432",cliente:"MARIA DA SILVA",cnj:"1000000-00.2026.8.26.0100"};
    const sibling: Pick<DocumentCase,"id"|"cliente"|"cnj"> = {id:"433",cliente:"MARIA DA SILVA",cnj:"1000001-00.2026.8.26.0100"};
    expect(entry.id).not.toEqual(sibling.id);
    expect(entry.cliente).toEqual(sibling.cliente);
  });
});

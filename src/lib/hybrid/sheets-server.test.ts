import { describe, expect, it } from "vitest";
import { buildAtendimentoMirrorRow } from "./sheets-server";

describe("atendimento Sheets mirror contract", () => {
  it("emits canonical and legacy return aliases", () => {
    const row = buildAtendimentoMirrorRow({ protocolo: "123", empresaId: "e1", ultimoRetorno: "2026-09-03", proximoPrazo: "2026-09-10", observacao: "ok", situacao: "EM ANDAMENTO", actorName: "Ana" });
    expect(row.UltimoRetorno).toBe("2026-09-03");
    expect(row.Retorno).toBe(row.UltimoRetorno);
    expect(row.ProximoRetorno).toBe("2026-09-10");
    expect(row.Prazo).toBe(row.ProximoRetorno);
    expect(row.AtendidoPor).toBe("Ana");
    expect(row.Responsavel).toBe(row.AtendidoPor);
  });

  it("does not include indicator columns", () => {
    const row = buildAtendimentoMirrorRow({ protocolo: "123", empresaId: "e1", ultimoRetorno: "2026-09-03", proximoPrazo: null, observacao: "", situacao: "EM ANDAMENTO" });
    expect(row).not.toHaveProperty("tem_novo_andamento");
    expect(row).not.toHaveProperty("djen_nova_comunicacao");
  });
});

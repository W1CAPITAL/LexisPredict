import { describe, expect, it } from "vitest";
import { buildAtendimentoMirrorRow } from "./sheets-server";

describe("atendimento Sheets mirror contract", () => {
  it("emits canonical and legacy return aliases", () => {
    const row = buildAtendimentoMirrorRow({ protocolo: "123", empresaId: "e1", ultimoRetorno: "2026-09-03", proximoPrazo: "2026-09-10", observacao: "ok", situacao: "EM ANDAMENTO", actorName: "Ana", actorId: "supervisor-1", ownerId: "operador-2" });
    expect(row.UltimoRetorno).toBe("2026-09-03");
    expect(row.Retorno).toBe(row.UltimoRetorno);
    expect(row.ProximoRetorno).toBe("2026-09-10");
    expect(row.Prazo).toBe(row.ProximoRetorno);
    expect(row.AtendidoPor).toBe("Ana");
    expect(row.Responsavel).toBe("operador-2");
    expect(row.atendido_por).toBe("supervisor-1");
    expect(row.created_by).toBe("operador-2");
  });

  it("does not include indicator columns", () => {
    const row = buildAtendimentoMirrorRow({ protocolo: "123", empresaId: "e1", ultimoRetorno: "2026-09-03", proximoPrazo: null, observacao: "", situacao: "EM ANDAMENTO" });
    expect(row).not.toHaveProperty("Responsavel");
    expect(row).not.toHaveProperty("created_by");
    expect(row).not.toHaveProperty("tem_novo_andamento");
    expect(row).not.toHaveProperty("djen_nova_comunicacao");
  });
});

import { describe, expect, it } from "vitest";
import {
  stripThinking,
  extractFirstJsonObject,
  parseProposal,
  buildLotePatch,
  cicloId,
  normalizeInboxDrop,
} from "../../scripts/selfimprove/lib.mjs";

describe("stripThinking", () => {
  it("remove bloco <think> completo", () => {
    expect(stripThinking("<think>raciocinando</think>{\"a\":1}")).toBe('{"a":1}');
  });
  it("remove <think> sem fechamento", () => {
    expect(stripThinking("<think>lol")).toBe("");
  });
  it("mantém texto sem think", () => {
    expect(stripThinking("olá mundo")).toBe("olá mundo");
  });
});

describe("extractFirstJsonObject", () => {
  it("extrai JSON com chaves aninhadas e strings com chaves", () => {
    const txt = 'prefiro {"a":{"b":"x { y }"},"c":[1,2]} fim';
    expect(extractFirstJsonObject(txt)).toEqual({ a: { b: "x { y }" }, c: [1, 2] });
  });
  it("ignora fences de código", () => {
    const txt = '```json\n{"ok":true}\n```';
    expect(extractFirstJsonObject(txt)).toEqual({ ok: true });
  });
  it("retorna null sem JSON", () => {
    expect(extractFirstJsonObject("nada aqui")).toBeNull();
  });
  it("retorna null em JSON quebrado", () => {
    expect(extractFirstJsonObject('{"a":')).toBeNull();
  });
});

describe("parseProposal", () => {
  const resposta = `<think>hmm</think>
{
  "resumo": "app saudável, 2 melhorias",
  "diagnostico": ["sem erros de build"],
  "propostas": [
    {"titulo": "Memo no sidebar", "prioridade": "P1", "arquivos": ["src/components/layout/sidebar.tsx"], "descricao": "...", "risco": "baixo"},
    {"titulo": "sem patch diff", "prioridade": "P9", "arquivos": [], "descricao": "", "risco": ""}
  ],
  "proximos_passos": ["aplicar", "testar"]
}`;
  it("normaliza propostas, prioridade inválida vira P2, patch ausente vira null", () => {
    const r = parseProposal(resposta);
    expect(r.ok).toBe(true);
    expect(r.propostas).toHaveLength(2);
    expect(r.propostas[0].prioridade).toBe("P1");
    expect(r.propostas[0].patch).toBeNull();
    expect(r.propostas[1].prioridade).toBe("P2");
    expect(r.resumo).toContain("app saudável");
  });
  it("rejeita resposta sem JSON", () => {
    expect(parseProposal("desculpa, não sei").ok).toBe(false);
  });
});

describe("buildLotePatch", () => {
  it("concatena só propostas com patch e adiciona cabeçalho", () => {
    const lote = buildLotePatch([
      { id: 1, titulo: "A", patch: "--- a/x.ts\n+++ b/x.ts\n@@ -1 +1 @@" },
      { id: 2, titulo: "B", patch: null },
      { id: 3, titulo: "C", patch: "--- a/y.ts\n+++ b/y.ts\n@@ -1 +1 @@" },
    ]);
    expect(lote).toContain("# ── Proposta 1: A");
    expect(lote).toContain("--- a/x.ts");
    expect(lote).toContain("--- a/y.ts");
    expect(lote).not.toContain("Proposta 2");
  });
  it("retorna null sem nenhum patch", () => {
    expect(buildLotePatch([{ id: 1, titulo: "A", patch: null }])).toBeNull();
  });
});

describe("cicloId", () => {
  it("formato AAAAMMDD-HHMM ordenável", () => {
    expect(cicloId(new Date(2026, 8, 9, 7, 5))).toBe("20260909-0705");
  });
});

describe("normalizeInboxDrop", () => {
  it("aceita drop válido e sanitiza query/mensagem", () => {
    const r = normalizeInboxDrop({
      tipo: "lexis-selfimprove-inbox",
      versaoApp: "9.61.1",
      eventos: [{ tipo: "erro", rota: "/cases?token=segredo", mensagem: "x".repeat(600), count: 3 }],
    })!;
    expect(r).not.toBeNull();
    expect(r.eventos[0].rota).toBe("/cases");
    expect(r.eventos[0].mensagem.length).toBeLessThanOrEqual(401);
    expect(r.eventos[0].count).toBe(3);
  });
  it("rejeita drop de outro tipo", () => {
    expect(normalizeInboxDrop({ tipo: "outro", eventos: [] })).toBeNull();
  });
});

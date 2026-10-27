import React from "react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it, expect } from "vitest";
import { AnalisesPessoaisPdf } from "./analises-internas-pdf";
import type { AnalisesPessoaisPdfData } from "./analises-internas-pdf";

const fixture: AnalisesPessoaisPdfData = {
  nome: "Colaborador de teste",
  geradoEm: "2026-10-27T18:00:00.000Z",
  filtros: { busca: "", categoria: "" },
  paginas: { analises: 1, atividades: 1, acoes: 1 },
  totais: { analises: 1, atividades: 1, acoes: 1, documentais: 1 },
  analises: [{
    id: "analise-1", protocolo_ref: "0000000-00.2026.8.26.0000",
    categoria: "auditoria_documental", descricao: "Análise específica com relatório.",
    origem: "revisão interna", data_atividade: "2026-10-27", nivel_conferencia: "documental",
  }],
  atividades: [{
    id: "tarefa-1", titulo: "Conferir documentação", categoria: "outro",
    descricao: "Atividade registrada manualmente.", data_realizacao: "2026-10-27",
    protocolo_ref: null,
  }],
  acoes: [{
    id: "acao-1", action: "edicao", created_at: "2026-10-27T18:00:00.000Z",
    protocolo_ref: "0000000-00.2026.8.26.0000",
  }],
};

describe("exportação PDF de análises internas", () => {
  it("gera um PDF real com capa e registros sem depender da impressão do navegador", async () => {
    const { renderToBuffer } = await import("@react-pdf/renderer");
    const component = React.createElement(AnalisesPessoaisPdf, { data: fixture });
    const pdf = await renderToBuffer(
      component as unknown as React.ReactElement<import("@react-pdf/renderer").DocumentProps>
    );
    expect(Buffer.from(pdf).subarray(0, 5).toString("ascii")).toBe("%PDF-");
    expect(pdf.length).toBeGreaterThan(1000);
  }, 30000);

  it("confere autorização individual no endpoint e filtro em cada fonte", () => {
    const api = readFileSync(resolve(process.cwd(), "src/app/api/analises-internas/pdf/route.ts"), "utf8");
    const page = readFileSync(resolve(process.cwd(), "src/app/analises-internas/page.tsx"), "utf8");
    expect(api).toContain("const ctx = await getUserContext()");
    expect(api).toContain("if (ctx.isViewer)");
    expect(api).toContain('.eq("responsavel_auth_user_id", usuario)');
    expect(api).toContain('.eq("auth_user_id", usuario)');
    expect(api).toContain('.eq("empresa_id", empresa)');
    expect(api).toContain('application/pdf');
    expect(api).toContain('attachment; filename=');
    expect(api).not.toContain('url.searchParams.get("usuario")');
    expect(page).toContain("AnalisesPdfExportButton");
  });
});

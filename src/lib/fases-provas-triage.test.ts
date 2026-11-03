import { describe, expect, it } from "vitest";
import {
  classifyFasesProvas, excelSafeCell, exportTriageRow,
  TRIAGE_EXPORT_HEADERS,
} from "@/lib/fases-provas-triage";

describe("triagem segura de réplicas e provas", () => {
  const base = { id:"1", protocolo:"1000000-01.2025.8.26.0001", cliente:"Cliente Exemplo", situacao:"EM ANDAMENTO" };

  it("distingue intimação DJEN de anotação e mostra ação objetiva sem inventar prazo", () => {
    const [r] = classifyFasesProvas([{
      ...base, observacao:"provas foram solicitadas pelo cliente",
      djen_ultimo_resumo:"Intimada a parte autora para especificação de provas",
      djen_ultima_data:"2026-10-27",
      djen_consultado_em:"2026-10-30",
    }]);
    expect(r.tipo).toBe("provas");
    expect(r.nivel).toBe("tribunal");
    expect(r.fonte).toContain("DJEN");
    expect(r.categoria).toBe("intimacao");
    expect(r.prioridade).toBe("alta");
    expect(r.acao).toMatch(/Ler a intimação/);
    expect(r.motivo).toMatch(/não é calculado nem confirmado/);
  });

  it("prioriza o registro oficial mais recente entre DataJud e DJEN", () => {
    const [r] = classifyFasesProvas([{
      ...base, observacao:"provas pendentes",
      datajud_ultimo_nome:"Provas apresentadas",
      datajud_ultimo_movimento:"2026-10-20",
      djen_ultimo_resumo:"Intimação para especificação de provas",
      djen_ultima_data:"2026-10-28",
    }]);
    expect(r.fonte).toContain("DJEN");
    expect(r.categoria).toBe("intimacao");
    expect(r.dataMovimento).toBe("28/10/2026");
  });

  it("apresentação afirmada pela equipe é registro interno, não protocolo confirmado", () => {
    const [r] = classifyFasesProvas([{...base,observacao:"Réplica apresentada conforme anotação."}]);
    expect(r.nivel).toBe("cadastro");
    expect(r.categoria).toBe("enviado");
    expect(r.fase).toContain("informado");
    expect(r.motivo).toContain("não há comprovante de protocolo");
  });

  it("negação do envio não vira documento apresentado", () => {
    const [r] = classifyFasesProvas([{...base,observacao:"Não foram apresentadas as provas solicitadas."}]);
    expect(r.categoria).toBe("pendencia");
    expect(r.prioridade).toBe("alta");
  });

  it("decisão posterior registrada no tribunal prevalece sobre anotação antiga", () => {
    const [r] = classifyFasesProvas([{
      ...base, observacao:"Aguardando provas adicionais",
      datajud_ultimo_nome:"Sentença de improcedência",
      datajud_consultado_em:"2026-10-29",
    }]);
    expect(r.categoria).toBe("decisao");
    expect(r.nivel).toBe("tribunal");
    expect(r.fase).toContain("posterior");
  });

  it("ignora casos encerrados e evita duplicar o mesmo CNJ por etapa", () => {
    const a = {...base,observacao:"Réplica juntada e provas especificadas"};
    const seen = new Set<string>();
    expect(classifyFasesProvas([a],seen)).toHaveLength(2);
    expect(classifyFasesProvas([a],seen)).toHaveLength(0);
    expect(classifyFasesProvas([{...a,id:"2",situacao:"ENCERRADO"}])).toHaveLength(0);
  });

  it("não deduplica dois processos diferentes sem CNJ", () => {
    const rows = classifyFasesProvas([
      {id:"1",cliente:"Cliente A",observacao:"provas pendentes"},
      {id:"2",cliente:"Cliente B",observacao:"provas pendentes"},
    ]);
    expect(rows.map(r=>r.cliente)).toEqual(["Cliente A","Cliente B"]);
  });

  it("exporta colunas auditáveis e neutraliza fórmulas vindas do cadastro", () => {
    const [r] = classifyFasesProvas([{...base,cliente:"=HYPERLINK(\"https://hostile.test\")",observacao:"Juntada de provas"}]);
    const line = exportTriageRow(r);
    expect(line).toHaveLength(TRIAGE_EXPORT_HEADERS.length);
    expect(line[0].startsWith("'=")).toBe(true);
    expect(excelSafeCell("@SUM(1+1)")).toBe("'@SUM(1+1)");
    expect(excelSafeCell("-2+3")).toBe("'-2+3");
    expect(excelSafeCell("Pessoa física")).toBe("Pessoa física");
  });
});

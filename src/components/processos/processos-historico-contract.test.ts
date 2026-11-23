import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

describe("histórico de atendimentos e desempenho no Lexis", () => {
  it("apresenta histórico em um botão da visão do processo, sem nova aba", () => {
    const panel = read("src/components/processos/processos-command-center.tsx");
    expect(panel).toContain("Histórico de atendimentos");
    expect(panel).toContain("AtendimentosProcessoHistorico");
    expect(panel).not.toContain('["attendance","Atendimentos"]');
  });

  it("nunca consulta histórico de todos os processos na abertura da página", () => {
    const panel = read("src/components/processos/historico-atendimentos-processo.tsx");
    expect(panel).toContain("getHistoricoAtendimentoProcessoAction");
    expect(panel).toContain("useEffect");
    expect(read("src/components/processos/processos-command-center.tsx")).toContain("historicoOpen && selected");
  });

  it("a API limita o histórico ao processo autenticado e à sua empresa", () => {
    const server = read("src/app/actions/historico-atendimento-processo-action.ts");
    expect(server).toContain("getUserContext()");
    expect(server).toContain("getSupabaseAdmin()");
    expect(server).toContain(".eq('empresa_id', ctx.empresa_id)");
    expect(server).toContain(".eq('id', processId)");
    expect(server).toContain(".limit(30)");
    expect(server).toContain("auditoria_logs_app");
    expect(server).toContain("tarefas_realizadas");
  });

  it("a página não atualiza os processos inteiros a cada foco e evita KPI pesado oculto", () => {
    const page = read("src/app/processos/page.tsx");
    expect(page).toContain("FIRST_PROCESSES_PAGE_LIMIT");
    expect(page).toContain("shouldRefreshCompanyProcesses(");
    expect(page).toContain("teamDetailsOpen &&");
    expect(page).not.toContain("},20_000)");
  });
});

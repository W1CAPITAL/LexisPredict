import { describe, expect, it } from "vitest";
import { normalizarTarefaRealizada, validarTarefaRealizada } from "./tarefas-realizadas";

describe("edição de atividades manuais", () => {
  const base = {
    titulo: "  Analisei o processo  ",
    descricao: "  Conferi os autos  ",
    categoria: "analise_processual",
    data_realizacao: "2026-11-08",
    protocolo_ref: "0000000-00.2026.8.26.0000",
    contato_confirmado: false,
  };

  it("normaliza o texto antes de salvar sem modificar o executor", () => {
    expect(normalizarTarefaRealizada(base)).toEqual({
      titulo: "Analisei o processo",
      descricao: "Conferi os autos",
      categoria: "analise_processual",
      data_realizacao: "2026-11-08",
      protocolo_ref: "0000000-00.2026.8.26.0000",
      contato_cliente_confirmado: false,
    });
  });

  it("aceita edição válida de atividade passada", () => {
    expect(validarTarefaRealizada(normalizarTarefaRealizada(base), "2026-11-09")).toBe(true);
  });

  it("rejeita datas futuras e CNJ inválido", () => {
    expect(validarTarefaRealizada(normalizarTarefaRealizada({...base,data_realizacao:"2026-11-10"}),"2026-11-09")).toBe(false);
    expect(validarTarefaRealizada(normalizarTarefaRealizada({...base,protocolo_ref:"ABC"}),"2026-11-09")).toBe(false);
  });

  it("só permite confirmação de contato em atendimento", () => {
    expect(validarTarefaRealizada(normalizarTarefaRealizada({...base,contato_confirmado:true}),"2026-11-09")).toBe(false);
    expect(validarTarefaRealizada(normalizarTarefaRealizada({...base,categoria:"atendimento",contato_confirmado:true}),"2026-11-09")).toBe(true);
  });

  it("não aceita título vazio ou categoria desconhecida", () => {
    expect(validarTarefaRealizada(normalizarTarefaRealizada({...base,titulo:" "}),"2026-11-09")).toBe(false);
    expect(validarTarefaRealizada(normalizarTarefaRealizada({...base,categoria:"ficticia"}),"2026-11-09")).toBe(false);
  });
});

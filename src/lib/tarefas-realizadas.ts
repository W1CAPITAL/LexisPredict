/** Regras comuns à criação e edição de atividades manuais. */
export type TarefaRealizadaInput = {
  titulo: string;
  descricao: string;
  categoria: string;
  data_realizacao: string;
  protocolo_ref: string;
  contato_confirmado: boolean;
};

export const CATEGORIAS_TAREFAS_REALIZADAS = [
  ["atendimento", "Atendimento"],
  ["analise_processual", "Análise de processo"],
  ["auditoria", "Auditoria"],
  ["dossie", "Dossiê"],
  ["investigacao", "Investigação"],
  ["planilha", "Planilha"],
  ["sistema", "Sistema"],
  ["automacao", "Automação"],
  ["outro", "Outra"],
] as const;

export function normalizarTarefaRealizada(input: TarefaRealizadaInput) {
  return {
    titulo: String(input.titulo || "").trim(),
    descricao: String(input.descricao || "").trim(),
    categoria: String(input.categoria || "").trim(),
    data_realizacao: String(input.data_realizacao || "").trim(),
    protocolo_ref: String(input.protocolo_ref || "").trim(),
    contato_cliente_confirmado: Boolean(input.contato_confirmado),
  };
}

export function validarTarefaRealizada(
  tarefa: ReturnType<typeof normalizarTarefaRealizada>,
  hoje: string,
): boolean {
  return tarefa.titulo.length >= 4 && tarefa.titulo.length <= 180
    && tarefa.descricao.length <= 4000
    && CATEGORIAS_TAREFAS_REALIZADAS.some(([categoria]) => categoria === tarefa.categoria)
    && /^20\d{2}-\d{2}-\d{2}$/.test(tarefa.data_realizacao)
    && tarefa.data_realizacao >= "2020-01-01"
    && tarefa.data_realizacao <= hoje
    && (!tarefa.protocolo_ref || /^\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4}$/.test(tarefa.protocolo_ref))
    && (!tarefa.contato_cliente_confirmado || tarefa.categoria === "atendimento");
}

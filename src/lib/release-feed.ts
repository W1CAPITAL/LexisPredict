/** Fonte única: notas, changelog e próximas (compacto). */

export const RELEASE_VERSION = "9.75.0";

export const RELEASE_CHANGELOG: string[] = [
  "9.75 — Fila Encerrados a revisar no Painel (procedente/cumprimento/restore); política de auto-encerrar só improcedente limpo.",
  "9.74 — Escopo pessoal em /cases, fila, dashboard e report; empresa só em /processos; SQL rateia sem dono.",
  "9.72 — Encerrado/arquivado não vira Vencido; dedupe CNJ; cache v3; SQL restaura encerrados e remove duplicatas.",
  "9.71 — Dashboard restaurado (não mais Configurações); encerrado/arquivado volta a contar; órfãos (sem dono) visíveis.",
  "9.69 — Processos: save qualquer cargo (service role + match CNJ); reabrir ENCERRADO/AGUARD.PROTOCOLO; status falso-encerrado corrigido.",
  "9.69 — Cases/Tarefas: só meus processos. Processos da Empresa: todos, atendimento sem trocar dono.",
  "9.68 — Contraste sólido + cor das letras na personalização.",
  "9.67 — Changelog compacto no menu lateral.",
];

export const RELEASE_NOTES: { id: string; titulo: string; corpo: string }[] = [
  {
    id: "n1",
    titulo: "Minha carteira",
    corpo: "Em Processos e Fila você vê só os casos em que você é o responsável (created_by).",
  },
  {
    id: "n2",
    titulo: "Processos da empresa",
    corpo: "Aba dedicada para ver e editar todos. Atendimento registra quem trabalhou, sem mudar o dono.",
  },
];

export const RELEASE_PROXIMAS: { id: string; titulo: string; corpo: string }[] = [
  {
    id: "p1",
    titulo: "Log de scan",
    corpo: "Worker DataJud no mesmo feed CNJ · motor · hora.",
  },
];

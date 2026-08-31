/** Fonte única: notas, changelog e próximas (compacto). */

export const RELEASE_VERSION = "9.95.0";

export const RELEASE_CHANGELOG: string[] = [
  "9.95 — Sincronizar/registrar atendimento: saveMany existia só no import (clique morria). Fallback + toast de erro.",
  "9.94 — Tarefas: filtro É hoje = prazo de hoje (igual /processos). Meus hoje lê a data certo. Anúncio volta em 3 dias, não a cada F5. Offline v6.2 no aviso.",
  "9.93 — Coming soon Offline no web: anúncio fechável + imagem + /offline. READMEs web e EXE.",
  "9.92 — Ranking/semana pelo LOG (pessoa+CNJ único). W1 não conta como operador. Lista não some com filtro velho.",
  "9.91 — /processos: atendimento credita quem atendeu (atendido_por); created_by travado sem force_transfer.",
  "9.90 — Agentes CRM (skills CompAI + fila + API /api/crm/agent).",
  "9.82 — Guard CNJ no save; SQL limpa SOLICITAR protocolo; SCHEMA-SUPABASE.md (diagrama multi-tenant).",
  "9.81 — Fix guardTransicaoEncerrarGabinete no save (atender /processos); Dialog a11y; Sem Prazo+baixa → fila revisao.",
  "9.79 — Encerrados a revisar sob o Painel; lote: J/K, Meus/Empresa, dispensar, lote confirmar, copiar CNJ.",
  "9.77 — Aba Encerrados a revisar no sidebar (fila dedicada como contato: flags, reabrir, confirmar).",
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

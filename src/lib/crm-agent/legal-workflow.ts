export type LegalWorkflowPriority = "critical" | "high" | "normal";
export type LegalWorkflowOwner = "advogado" | "operacao" | "controladoria";

export type LegalWorkflowStep = {
  id: string;
  title: string;
  detail: string;
  priority: LegalWorkflowPriority;
  owner: LegalWorkflowOwner;
  evidence: string;
  requiresHumanReview: true;
};

export type LegalWorkflow = {
  cliente: string;
  protocolo: string;
  tribunal: string;
  status: string;
  lastMovement: string;
  djenSummary: string;
  djenDate: string;
  isClosed: boolean;
  signals: string[];
  steps: LegalWorkflowStep[];
  warnings: string[];
  generatedAt: string;
};

type CaseLike = Record<string, unknown>;

function text(value: unknown, fallback = ""): string {
  if (typeof value !== "string" && typeof value !== "number") return fallback;
  const result = String(value).trim();
  return result || fallback;
}

function truthy(value: unknown): boolean {
  return value === true || value === 1 || value === "true";
}

function normalizeDate(value: unknown): string | null {
  const raw = text(value);
  if (!raw || raw === "-" || raw === "—" || raw === "0") return null;
  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const br = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (br) return `${br[3]}-${br[2]}-${br[1]}`;
  return null;
}

function localDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function priorityRank(priority: LegalWorkflowPriority): number {
  return priority === "critical" ? 0 : priority === "high" ? 1 : 2;
}

function makeStep(
  id: string,
  title: string,
  detail: string,
  priority: LegalWorkflowPriority,
  owner: LegalWorkflowOwner,
  evidence: string
): LegalWorkflowStep {
  return {
    id,
    title,
    detail,
    priority,
    owner,
    evidence,
    requiresHumanReview: true,
  };
}

function safeSummary(value: unknown, max = 420): string {
  return text(value).replace(/\s+/g, " ").slice(0, max);
}

/**
 * Builds a legal operations playbook from fields already stored in Lexis.
 * It is deliberately read-only: it does not calculate procedural deadlines,
 * contact clients, mutate cases, or treat automated flags as court orders.
 */
export function buildLegalWorkflow(caseData: object, now = new Date()): LegalWorkflow {
  const c = caseData as CaseLike;
  const protocolo = text(c.protocolo || c.protocolo_ref || c.processo_cnj, "Não informado");
  const cliente = text(c.cliente || c.cliente_nome || c.nome_cliente, "Cliente não identificado");
  const tribunal = text(c.tribunal || c.orgao_julgador, "Tribunal não identificado");
  const status = text(c.status || c.situacao || c.status_interno || c.statusInterno, "Status não informado");
  const lastMovement = safeSummary(c.datajud_ultimo_nome || c.datajud_ultimo_movimento || c.evento_resumo, "Sem movimentação descrita");
  const djenSummary = safeSummary(c.djen_ultimo_resumo, "Sem resumo DJEN cadastrado");
  const djenDate = text(c.djen_ultima_data, "Data não informada");
  const eventType = text(c.evento_tipo).toLowerCase();
  const statusText = [
    status,
    text(c.status_interno),
    text(c.statusInterno),
    text(c.situacao),
  ].join(" ");
  const isClosed = truthy(c.datajud_encerrado_tribunal) || /encerrad|arquivad|extint|baixad/i.test(statusText);
  const today = localDate(now);
  const nextReturn = normalizeDate(c.proximo_retorno || c.proximoRetorno);
  const returnIsDue = Boolean(nextReturn && nextReturn <= today);

  const signals: string[] = [];
  const steps: LegalWorkflowStep[] = [];
  const warnings: string[] = [];

  const hasBa = truthy(c.indicio_busca_apreensao) || eventType === "ba";
  if (hasBa) {
    signals.push("busca_apreensao");
    const confidence = text(c.busca_apreensao_confianca, "não informada").toLowerCase();
    const reason = safeSummary(c.busca_apreensao_motivo, "Flag de busca e apreensão registrada no cadastro.");
    const priority: LegalWorkflowPriority = confidence === "alta" ? "critical" : "high";
    steps.push(makeStep(
      "validar_busca_apreensao",
      "Priorizar a validação de busca e apreensão",
      "Conferir decisão, mandado, situação atual e movimentação diretamente na fonte oficial. O sinal automatizado não comprova, sozinho, a existência de ordem vigente.",
      priority,
      "advogado",
      reason
    ));
    if (confidence === "baixa" || confidence === "não informada") {
      warnings.push("O indício de busca e apreensão tem confiança baixa ou não informada; exige validação humana e documento oficial antes de qualquer comunicação ou providência.");
    }
  }

  const hasDjen = truthy(c.djen_nova_comunicacao) ||
    (truthy(c.tem_novo_andamento) && text(c.evento_fonte).toLowerCase() === "djen");
  if (hasDjen) {
    signals.push("publicacao_djen");
    steps.push(makeStep(
      "conferir_publicacao_djen",
      "Conferir a comunicação original no DJEN",
      "Abrir a publicação original, confirmar disponibilização, publicação, destinatário e teor integral. Somente depois da leitura humana registrar eventual prazo e providência; o resumo não calcula prazo.",
      "high",
      "controladoria",
      [djenDate, djenSummary].filter(Boolean).join(" · ")
    ));
    if (!text(c.djen_ultimo_link)) {
      warnings.push("Há sinal de nova comunicação DJEN, mas o cadastro não contém link original; localizar a publicação no portal oficial.");
    }
  }

  const hearingDate = normalizeDate(c.audiencia_data || c.data_audiencia || c.audiencia_em);
  const hasHearing = eventType.startsWith("audiencia_") || truthy(c.tem_audiencia) || Boolean(hearingDate);
  if (hasHearing) {
    signals.push("audiencia");
    steps.push(makeStep(
      "preparar_audiencia",
      "Preparar e confirmar a audiência",
      "Confirmar data, horário, modalidade, link oficial e responsável. Conferir documentos e orientações ao cliente; depois da audiência, registrar o resultado e o próximo passo.",
      "high",
      "advogado",
      [text(c.evento_resumo), hearingDate || text(c.audiencia_data || c.data_audiencia)].filter(Boolean).join(" · ") || "Sinal de audiência no cadastro."
    ));
  }

  const judgmentTypes = ["sentenca_procedente", "sentenca_parcial", "sentenca_improcedente"];
  if (judgmentTypes.includes(eventType)) {
    signals.push("sentenca");
    steps.push(makeStep(
      "revisar_sentenca",
      "Revisar a sentença e o dispositivo",
      "Ler a decisão integral e separar pedidos acolhidos e negados. Conferir fundamentação, sucumbência, custas e justiça gratuita; o advogado responsável define o próximo passo.",
      "high",
      "advogado",
      safeSummary(c.evento_resumo || c.datajud_ultimo_nome, "Tipo de evento de sentença registrado no cadastro.")
    ));
  }

  if (truthy(c.em_cumprimento_sentenca) || truthy(c.cumprimento_pendente_necessario)) {
    signals.push("cumprimento");
    steps.push(makeStep(
      "verificar_cumprimento",
      "Verificar a fase de cumprimento de sentença",
      "Conferir trânsito em julgado, decisão, cálculos, intimação para pagamento, depósitos, honorários sucumbenciais e custas. Não informar valores ao cliente sem documento e revisão humana.",
      "high",
      "advogado",
      safeSummary(c.cumprimento_sentenca_motivo || c.detalhes_execucao, "Flag de cumprimento registrada no cadastro.")
    ));
  }

  if (returnIsDue) {
    signals.push("retorno_operacional");
    steps.push(makeStep(
      "realizar_retorno_cliente",
      "Realizar o retorno operacional ao cliente",
      "Revisar o último atendimento e as movimentações posteriores, preparar uma atualização objetiva e registrar o próximo retorno. Esta data é de acompanhamento interno, não um prazo processual.",
      "normal",
      "operacao",
      `Próximo retorno cadastrado: ${nextReturn}`
    ));
    warnings.push("O próximo retorno cadastrado está vencido ou é hoje; isso é um retorno operacional e não deve ser confundido com prazo processual.");
  }

  if (truthy(c.tem_atualizacao_pos_retorno) || truthy(c.tem_novo_andamento)) {
    signals.push("movimentacao_recente");
    steps.push(makeStep(
      "revisar_movimentacao",
      "Revisar a movimentação recente",
      "Conferir o movimento e sua fonte, abrir o teor completo quando disponível e só então atualizar a fase, registrar prazo ou comunicar o cliente.",
      "normal",
      "controladoria",
      lastMovement
    ));
  }

  if (isClosed) {
    signals.push("encerramento");
    steps.push(makeStep(
      "confirmar_encerramento",
      "Confirmar a baixa e verificar pendências residuais",
      "Conferir motivo e data de encerramento no tribunal. Verificar se ainda existe cumprimento, levantamento, custas ou outra pendência antes de finalizar o acompanhamento.",
      "normal",
      "advogado",
      status
    ));
    warnings.push("O cadastro sinaliza encerramento ou baixa; confirme a situação e eventuais pendências no tribunal antes de finalizar tarefas.");
  }

  if (steps.length === 0) {
    steps.push(makeStep(
      "consultar_fonte_oficial",
      "Consultar a situação na fonte oficial",
      "Não há sinal operacional específico suficiente no cadastro. Conferir o histórico oficial do tribunal e registrar a próxima providência somente após identificar o movimento.",
      "normal",
      "controladoria",
      "Nenhum sinal operacional específico foi identificado nos campos consultados."
    ));
    warnings.push("Nenhum sinal operacional específico foi encontrado no cadastro. Não inferir prazo ou providência sem consultar a fonte oficial.");
  }

  steps.sort((a, b) => priorityRank(a.priority) - priorityRank(b.priority));
  warnings.unshift("Este plano é derivado dos campos atualmente cadastrados; os sinais internos não substituem publicação, decisão ou consulta oficial.");

  return {
    cliente,
    protocolo,
    tribunal,
    status,
    lastMovement,
    djenSummary,
    djenDate,
    isClosed,
    signals: [...new Set(signals)],
    steps,
    warnings: [...new Set(warnings)],
    generatedAt: now.toISOString(),
  };
}

export function formatLegalWorkflowReport(workflow: LegalWorkflow): string {
  const priorityLabel: Record<LegalWorkflowPriority, string> = {
    critical: "URGENTE — validar imediatamente",
    high: "PRIORIDADE",
    normal: "ROTINA",
  };
  const lines = [
    "## Fluxo jurídico sugerido",
    `**Cliente:** ${workflow.cliente}`,
    `**Processo:** ${workflow.protocolo}`,
    `**Tribunal:** ${workflow.tribunal}`,
    `**Status cadastrado:** ${workflow.status}`,
    `**Última movimentação cadastrada:** ${workflow.lastMovement}`,
    "",
    "### Sinais identificados no cadastro",
    workflow.signals.length
      ? workflow.signals.map((signal) => `- ${signal.replace(/_/g, " ")}`).join("\n")
      : "- Nenhum sinal específico.",
    "",
    "### Etapas recomendadas",
    ...workflow.steps.map((step, index) =>
      `${index + 1}. **[${priorityLabel[step.priority]}] ${step.title}**\n   ${step.detail}\n   Responsável sugerido: ${step.owner}. Evidência: ${step.evidence}`
    ),
    "",
    "### Alertas e validações",
    ...workflow.warnings.map((warning) => `- ${warning}`),
    "",
    "### Limites de execução",
    "Plano somente de leitura: não consulta o tribunal, não calcula prazo processual, não altera o processo, não cria tarefas e não envia mensagens. Toda providência exige conferência da fonte oficial e revisão humana.",
  ];
  return lines.join("\n");
}

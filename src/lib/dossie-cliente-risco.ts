/** Risco + diagnóstico (fortes / atenção) + plano de ação */

export type RiskDriver = { label: string; pontos: number; severidade: "alta" | "media" | "baixa" };

export function scoreRiscoProcesso(c: Record<string, any>, extras?: {
  movimentos?: any[];
  djenTexts?: string[];
}): {
  score: number;
  nivel: "Baixo" | "Moderado" | "Alto" | "Crítico";
  chanceRuim: string;
  drivers: RiskDriver[];
  resumo: string;
  pontosFortes: string[];
  pontosAtencao: string[];
  planoAcao: string[];
  leituraEstrategica: string;
  faseAtual: string;
} {
  const drivers: RiskDriver[] = [];
  let score = 8;
  const status = String(c.status || c.situacao || "");
  const evento = String(c.evento_tipo || "");
  const resumoEv = String(c.evento_resumo || c.djen_ultimo_resumo || "").toLowerCase();
  const blob = [
    resumoEv,
    ...(extras?.djenTexts || []),
    ...((extras?.movimentos || []).map((m) => `${m.nome || ""} ${m.complemento || ""}`)),
  ]
    .join(" ")
    .toUpperCase();

  const pontosFortes: string[] = [];
  const pontosAtencao: string[] = [];
  const planoAcao: string[] = [];

  if (/vencido/i.test(status)) {
    drivers.push({ label: "Prazo vencido na carteira", pontos: 28, severidade: "alta" });
    score += 28;
    pontosAtencao.push(
      `Prazo vencido na carteira interna${c.proximoPrazo ? ` desde ${c.proximoPrazo}` : ""} — maior fator de risco operacional (+28 pts).`
    );
    planoAcao.push(
      `Contato imediato com o cliente — regularizar o prazo vencido${c.proximoPrazo ? ` (${c.proximoPrazo})` : ""} e atualizar o status.`
    );
  } else if (/hoje|aten[cç][aã]o/i.test(status)) {
    drivers.push({ label: "Prazo em atenção / é hoje", pontos: 14, severidade: "media" });
    score += 14;
    pontosAtencao.push("Prazo em atenção na carteira — requer ação no mesmo dia.");
    planoAcao.push("Tratar o prazo do dia e registrar o retorno no CRM.");
  }

  if (c.tem_novo_andamento || c.tem_atualizacao_pos_retorno) {
    drivers.push({ label: "Movimentação após último retorno", pontos: 12, severidade: "media" });
    score += 12;
  }
  if (c.djen_nova_comunicacao) {
    drivers.push({ label: "Nova publicação DJEN após retorno", pontos: 14, severidade: "alta" });
    score += 14;
    pontosAtencao.push("Há publicação no diário após o último retorno — ler o teor e orientar o cliente.");
  }

  if (evento === "ba" || /BUSCA\s*E\s*APREENS/.test(blob)) {
    drivers.push({ label: "Indício de busca e apreensão", pontos: 30, severidade: "alta" });
    score += 30;
    pontosAtencao.push("Indício de busca e apreensão — prioridade máxima de contato.");
    planoAcao.unshift("Confirmar teor de B.A. no tribunal e acionar o cliente imediatamente.");
  }

  if (evento === "transito_ou_baixa" || c.datajud_encerrado_tribunal || /BAIXA\s+DEFINITIVA|TR[AÂ]NSITO\s+EM\s+JULGADO/.test(blob)) {
    drivers.push({ label: "Trânsito em julgado / baixa no tribunal", pontos: 10, severidade: "media" });
    score += 10;
    pontosFortes.push("Há registro de trânsito em julgado e/ou baixa definitiva no tribunal — fase formal de conhecimento encerrada.");
  }

  if (c.em_cumprimento_sentenca || /CUMPRIMENTO\s+DE\s+SENTEN[CÇ]A/.test(blob)) {
    drivers.push({ label: "Em cumprimento de sentença", pontos: 6, severidade: "baixa" });
    score += 6;
    pontosFortes.push(
      "Processo em cumprimento de sentença — indício de resultado de mérito favorável ou decisão a executar."
    );
    planoAcao.push("Confirmar no tribunal o estágio do cumprimento e eventuais valores a levantar.");
  }

  if (/INDEFER.*INICIAL|EXTIN[CÇ].*SEM.*M[EÉ]RITO|ARTIGO\s*485/.test(blob)) {
    drivers.push({ label: "Indeferimento / extinção sem mérito", pontos: 18, severidade: "alta" });
    score += 18;
    pontosAtencao.push("Indeferimento da inicial ou extinção sem mérito — direito material em regra preservado, mas a ação atual encerrou.");
    planoAcao.push("Orientar o cliente sobre extinção formal e avaliar nova propositura com documentação regular.");
  }

  if (/CUSTAS|DARE|PREPARO/.test(blob)) {
    pontosFortes.push("Há movimentação de custas/intimação de pagamento — útil para rastrear condenação ou quitação.");
    planoAcao.push("Checar quitação de custas/guia eventualmente intimada no DJEN.");
  }

  const ultimo = c.ultimoRetorno || c.ultimo_retorno;
  if (!ultimo) {
    drivers.push({ label: "Sem retorno registrado ao cliente", pontos: 8, severidade: "baixa" });
    score += 8;
    pontosAtencao.push("Nenhum retorno ao cliente registrado no CRM.");
  } else {
    pontosAtencao.push(`Último retorno ao cliente em ${ultimo} — verificar se o ciclo de comunicação está em dia.`);
  }

  if (pontosFortes.length === 0) {
    pontosFortes.push("Carteira possui identificação completa do processo (CNJ, cliente e tribunal) para monitoramento contínuo.");
  }

  score = Math.max(0, Math.min(100, score));
  let nivel: "Baixo" | "Moderado" | "Alto" | "Crítico" = "Baixo";
  if (score >= 75) nivel = "Crítico";
  else if (score >= 55) nivel = "Alto";
  else if (score >= 30) nivel = "Moderado";

  const chanceRuim =
    nivel === "Crítico"
      ? "Elevada — priorizar contato e leitura do teor hoje."
      : nivel === "Alto"
        ? "Relevante — validar tribunal e orientar o cliente em breve."
        : nivel === "Moderado"
          ? "Moderada — o risco tende a ser operacional (prazos/retorno), não necessariamente jurídico."
          : "Baixa no cenário atual — manter rotina de monitoramento.";

  let faseAtual = "Em andamento";
  if (c.em_cumprimento_sentenca || /CUMPRIMENTO\s+DE\s+SENTEN[CÇ]A/.test(blob)) faseAtual = "Cumprimento de Sentença";
  else if (c.datajud_encerrado_tribunal || /BAIXA\s+DEFINITIVA/.test(blob)) faseAtual = "Baixa / Arquivo";
  else if (/INDEFER|EXTIN[CÇ]/.test(blob)) faseAtual = "Extinção / Indeferimento";
  else if (/CONHECIMENTO|PROCEDIMENTO\s+COMUM/.test(blob)) faseAtual = "Conhecimento";

  if (!planoAcao.length) {
    planoAcao.push("Revisar cronologia DataJud/DJEN e registrar retorno no CRM.");
    planoAcao.push("Definir próxima data de acompanhamento na carteira.");
  }
  planoAcao.push("Atualizar o CRM após o contato (status, observação e próximo prazo).");

  const leituraEstrategica =
    score >= 30 && drivers.some((d) => /prazo|retorno/i.test(d.label))
      ? "Este tende a ser um caso de risco operacional, não necessariamente jurídico: a prioridade é fechar o ciclo de comunicação e execução para evitar insatisfação por falta de retorno."
      : "Monitore o teor oficial e mantenha o cliente informado a cada marco relevante.";

  const resumo = [
    `Status carteira: ${status || "—"}`,
    `Fase: ${faseAtual}`,
    c.evento_resumo || c.djen_ultimo_resumo || "Sem resumo de evento",
  ].join(" · ");

  return {
    score,
    nivel,
    chanceRuim,
    drivers,
    resumo,
    pontosFortes: pontosFortes.slice(0, 4),
    pontosAtencao: pontosAtencao.slice(0, 4),
    planoAcao: planoAcao.slice(0, 5),
    leituraEstrategica,
    faseAtual,
  };
}

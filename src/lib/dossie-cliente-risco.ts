/** Índice de risco operacional de um processo (0–100) + drivers legíveis */

export type RiskDriver = { label: string; pontos: number; severidade: "alta" | "media" | "baixa" };

export function scoreRiscoProcesso(c: Record<string, any>): {
  score: number;
  nivel: "Baixo" | "Moderado" | "Alto" | "Crítico";
  chanceRuim: string;
  drivers: RiskDriver[];
  resumo: string;
} {
  const drivers: RiskDriver[] = [];
  let score = 12;

  const status = String(c.status || c.status_prazo || c.situacao || "");
  const evento = String(c.evento_tipo || "");
  const resumoEv = String(c.evento_resumo || c.djen_ultimo_resumo || "").toLowerCase();

  if (/vencido/i.test(status)) {
    drivers.push({ label: "Prazo vencido na carteira", pontos: 28, severidade: "alta" });
    score += 28;
  } else if (/hoje|aten[cç][aã]o/i.test(status)) {
    drivers.push({ label: "Prazo em atenção / é hoje", pontos: 14, severidade: "media" });
    score += 14;
  }

  if (c.tem_novo_andamento || c.tem_atualizacao_pos_retorno) {
    drivers.push({ label: "Movimentação no tribunal após último retorno", pontos: 12, severidade: "media" });
    score += 12;
  }
  if (c.djen_nova_comunicacao) {
    drivers.push({ label: "Nova publicação DJEN após retorno", pontos: 14, severidade: "alta" });
    score += 14;
  }

  if (evento === "ba" || /busca\s*e\s*apreens/i.test(resumoEv)) {
    drivers.push({ label: "Indício de busca e apreensão", pontos: 30, severidade: "alta" });
    score += 30;
  }
  if (evento === "transito_ou_baixa" || c.datajud_encerrado_tribunal) {
    drivers.push({ label: "Trânsito em julgado / baixa no tribunal", pontos: 10, severidade: "media" });
    score += 10;
  }
  if (c.em_cumprimento_sentenca) {
    drivers.push({ label: "Em cumprimento de sentença", pontos: 8, severidade: "baixa" });
    score += 8;
  }
  if (/improcedente|negado\s+provimento|reforma/i.test(resumoEv)) {
    drivers.push({ label: "Teor desfavorável na última publicação", pontos: 16, severidade: "alta" });
    score += 16;
  }
  if (!c.ultimoRetorno && !c.ultimo_retorno) {
    drivers.push({ label: "Sem registro de retorno ao cliente", pontos: 8, severidade: "baixa" });
    score += 8;
  }

  score = Math.max(0, Math.min(100, score));

  let nivel: "Baixo" | "Moderado" | "Alto" | "Crítico" = "Baixo";
  if (score >= 75) nivel = "Crítico";
  else if (score >= 55) nivel = "Alto";
  else if (score >= 30) nivel = "Moderado";

  const chanceRuim =
    nivel === "Crítico"
      ? "Elevada — priorizar contato e leitura do teor hoje"
      : nivel === "Alto"
        ? "Relevante — validar tribunal e orientar o cliente em breve"
        : nivel === "Moderado"
          ? "Moderada — acompanhar prazos e próximas publicações"
          : "Baixa no cenário atual — manter rotina de monitoramento";

  const resumo = [
    `Status carteira: ${status || "—"}`,
    c.evento_resumo || c.djen_ultimo_resumo || c.datajud_ultimo_nome || "Sem resumo de evento",
    drivers.length
      ? `Principais fatores: ${drivers
          .slice(0, 3)
          .map((d) => d.label)
          .join("; ")}`
      : "Sem fatores críticos automáticos",
  ].join(" · ");

  return { score, nivel, chanceRuim, drivers, resumo };
}

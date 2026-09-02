/**
 * AUTO se tribunal já marcou baixa/trânsito e NÃO há residual FORTE (B.A. real ou cumprimento ativo claro).
 * REVISAR só com residual forte — não por flag suja isolada.
 *
 * IMPORTANTE: autoencerramento é OPT-IN.
 * Ausência da variável ou qualquer valor diferente de um ativador explícito mantém o recurso desligado.
 */

export type DecisaoEncerrarScan =
  | { acao: "auto_encerrar"; motivo: string }
  | { acao: "revisao_fila"; motivo: string; prioridade: number }
  | { acao: "nenhuma" };

/**
 * Autoencerramento permanece desligado até ativação explícita.
 *
 * Para ativar no futuro, configure a NOVA variável abaixo exatamente como:
 *   SCAN_AUTO_ENCERRAR_ATIVADO=1|true|on|sim|yes
 *
 * A variável legada SCAN_AUTO_ENCERRAR é deliberadamente ignorada para que uma
 * configuração antiga de produção com valor 1 não religue o autoencerramento.
 */
function on(): boolean {
  // OFF absoluto por padrão nesta versão.
  // Não lê a variável legada e NÃO permite ativação por ambiente.
  // Para reativar futuramente, altere este guard de forma deliberada.
  return false;
}

function truthy(v: unknown): boolean {
  if (v === true || v === 1) return true;
  if (v === false || v === 0 || v == null) return false;
  const s = String(v).trim().toLowerCase();
  return s === "true" || s === "1" || s === "sim" || s === "yes";
}

function blob(...parts: unknown[]): string {
  return parts.map((p) => String(p || "")).join(" ").toUpperCase();
}

function textoEncerradoForte(text: string): boolean {
  const t = text.toUpperCase();
  return (
    /BAIXA\s+DEFINITIVA|BAIXA\s+DO\s+PROCESSO|ARQUIVAMENTO|TRANSITO\s+EM\s+JULGADO|TRÂNSITO\s+EM\s+JULGADO/.test(
      t
    ) ||
    /EXTIN[CÇ][AÃ]O\s+DO\s+PROCESSO|PROCESSO\s+EXTINTO|JULGO\s+IMPROCEDENTE|IMPROCED[EÊ]NCIA/.test(
      t
    ) ||
    /CANCELAMENTO\s+DA\s+DISTRIBUI[CÇ][AÃ]O|DESER[CÇ][AÃ]O/.test(t)
  );
}

export function decidirEncerramentoScan(ctx: {
  target: any;
  patch: Record<string, any>;
}): DecisaoEncerrarScan {
  if (!on()) return { acao: "nenhuma" };

  const t = ctx.target || {};
  const p = ctx.patch || {};
  const d = (t.dados && typeof t.dados === "object" ? t.dados : {}) as any;

  if (
    truthy(t.via_scan_auto_encerrar) ||
    truthy(d.via_scan_auto_encerrar) ||
    truthy(p.via_scan_auto_encerrar)
  ) {
    return { acao: "nenhuma" };
  }

  const baixaTribunal = truthy(
    p.datajud_encerrado_tribunal ?? t.datajud_encerrado_tribunal ?? d.datajud_encerrado_tribunal
  );

  const text = blob(
    p.procedente_motivo,
    t.procedente_motivo,
    p.datajud_encerrado_motivo,
    t.datajud_encerrado_motivo,
    p.evento_resumo,
    t.evento_resumo,
    p.djen_ultimo_resumo,
    t.djen_ultimo_resumo,
    d.procedente_motivo,
    d.datajud_encerrado_motivo,
    d.evento_resumo,
    d.djen_ultimo_resumo
  );

  const baixaPorTexto = textoEncerradoForte(text);
  if (!baixaTribunal && !baixaPorTexto) return { acao: "nenhuma" };

  // Residual FORTE → revisar (só estes bloqueiam AUTO)
  const baRaw = p.indicio_busca_apreensao ?? t.indicio_busca_apreensao ?? d.indicio_busca_apreensao;
  const ba =
    truthy(baRaw) &&
    !/FALSO|JURISPRUD|CITAD|SEM\s+INDICIO|0/.test(String(baRaw).toUpperCase() + text);

  const cumprimentoAtivo =
    truthy(p.em_cumprimento_sentenca ?? t.em_cumprimento_sentenca ?? d.em_cumprimento_sentenca) &&
    !truthy(
      p.cumprimento_encerrado ?? t.cumprimento_encerrado ?? d.cumprimento_encerrado
    ) &&
    /CUMPRIMENTO|EXECU[CÇ][AÃ]O|PENHORA|SATISFA[CÇ][AÃ]O/.test(text);

  if (ba) {
    return {
      acao: "revisao_fila",
      motivo: "Indício real de B.A. — não auto-arquivar",
      prioridade: 95,
    };
  }
  if (cumprimentoAtivo) {
    return {
      acao: "revisao_fila",
      motivo: "Cumprimento/execução ainda ativo no teor — revisar",
      prioridade: 92,
    };
  }

  // AUTO somente quando a configuração opt-in estiver explicitamente ativa.
  const motivo =
    p.datajud_encerrado_motivo ||
    t.datajud_encerrado_motivo ||
    d.datajud_encerrado_motivo ||
    (baixaPorTexto ? "Teor indica baixa/extinção/trânsito" : null) ||
    "Baixa/trânsito no tribunal — auto gabinete W1";

  return { acao: "auto_encerrar", motivo: String(motivo) };
}

export function aplicarDecisaoNoPatch(
  patch: Record<string, any>,
  target: any,
  decisao: DecisaoEncerrarScan
): Record<string, any> {
  const out = { ...patch };
  const dadosBase =
    out.dados && typeof out.dados === "object"
      ? { ...out.dados }
      : target?.dados && typeof target.dados === "object"
        ? { ...target.dados }
        : {};

  if (decisao.acao === "auto_encerrar") {
    const nowIso = new Date().toISOString();
    const nowBr = new Date()
      .toLocaleString("sv-SE", { timeZone: "America/Sao_Paulo" })
      .slice(0, 10);
    out.situacao = "ENCERRADO";
    out.status = "Arquivado";
    out.statusManual = "Encerrado";
    out.status_interno = "ENCERRADO";
    out.diasFaltando = null;
    out.precisa_revisar_encerramento = false;
    out.prioridade_revisao_encerrado = 0;
    out.via_scan_auto_encerrar = true;
    out.datajud_encerrado_tribunal = true;
    out.scan_auto_encerrado_em = nowIso;
    out.scan_auto_encerrado_dia = nowBr;
    out.scan_auto_encerrar_motivo = decisao.motivo;
    out.operacao_sistema = {
      origem: "W1_CONTROL",
      perfil: "W1 CONTROL",
      tipo: "SCAN_AUTO_ENCERRAR",
      legenda: "Feito por Davi Alves Figueredo · scanner automático",
    };
    out.auditado_por_nome = "W1 CONTROL";
    out.auditado_legenda = "Feito por Davi Alves Figueredo · scanner automático";

    dadosBase.situacao = "ENCERRADO";
    dadosBase.statusManual = "Encerrado";
    dadosBase.status = "Arquivado";
    dadosBase.status_interno = "ENCERRADO";
    dadosBase.proximoPrazo = "";
    dadosBase.diasFaltando = null;
    dadosBase.via_scan_auto_encerrar = true;
    dadosBase.scan_auto_encerrado_em = nowIso;
    dadosBase.scan_auto_encerrado_dia = nowBr;
    dadosBase.scan_auto_encerrar_motivo = decisao.motivo;
    dadosBase.precisa_revisar_encerramento = false;
    dadosBase.operacao_sistema = out.operacao_sistema;
    dadosBase.auditado_por_nome = "W1 CONTROL";
    out.dados = dadosBase;
    return out;
  }

  if (decisao.acao === "revisao_fila") {
    out.precisa_revisar_encerramento = true;
    out.prioridade_revisao_encerrado = decisao.prioridade;
    dadosBase.precisa_revisar_encerramento = true;
    dadosBase.prioridade_revisao_encerrado = decisao.prioridade;
    dadosBase.scan_revisao_motivo = decisao.motivo;
    out.dados = dadosBase;
    return out;
  }

  return out;
}

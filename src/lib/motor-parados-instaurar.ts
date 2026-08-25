/**
 * Motor único: Processos Parados + "falta instaurar cumprimento".
 * Usado por: auditCaseCoreSystem (DataJud+DJEN), reclass local, cron 24h, worker.
 */
import {
  detectFlagsFase,
  ultimaDataTribunal,
  scoreAcaoParado,
  aindaDaParaAgirNoProcesso,
  type EstadoParado,
} from "@/lib/processos-parados";

export type MotorParadosResult = {
  motor_parados: Record<string, any>;
  /** true se deve marcar cumprimento_pendente_necessario */
  falta_instaurar: boolean;
  /** já em cumprimento ativo — não forçar instaurar */
  ja_ativo: boolean;
};

/**
 * target = caso antes do patch; patch = resultado do scan/reclass.
 * Devolve campos para merge em patch / patch.dados.
 */
export function applyMotorParadosInstaurar(
  target: any,
  patch: Record<string, any>
): MotorParadosResult {
  const d0 =
    target?.dados && typeof target.dados === "object" ? target.dados : {};
  const dP =
    patch?.dados && typeof patch.dados === "object" ? patch.dados : {};

  const merged: any = {
    ...d0,
    ...target,
    ...patch,
    ...dP,
    protocolo: target?.protocolo || patch?.protocolo || d0.protocolo,
    datajud_ultimo_movimento:
      patch.datajud_ultimo_movimento ??
      target?.datajud_ultimo_movimento ??
      d0.datajud_ultimo_movimento,
    datajud_ultimo_nome:
      patch.datajud_ultimo_nome ?? target?.datajud_ultimo_nome ?? d0.datajud_ultimo_nome,
    djen_ultimo_resumo:
      patch.djen_ultimo_resumo ?? target?.djen_ultimo_resumo ?? d0.djen_ultimo_resumo,
    djen_ultima_data:
      patch.djen_ultima_data ?? target?.djen_ultima_data ?? d0.djen_ultima_data,
    is_procedente: patch.is_procedente ?? target?.is_procedente ?? d0.is_procedente,
    em_cumprimento_sentenca:
      patch.em_cumprimento_sentenca ??
      target?.em_cumprimento_sentenca ??
      d0.em_cumprimento_sentenca,
    cumprimento_pendente_necessario:
      patch.cumprimento_pendente_necessario ??
      target?.cumprimento_pendente_necessario ??
      d0.cumprimento_pendente_necessario,
    cumprimento_ativo:
      patch.cumprimento_ativo ?? target?.cumprimento_ativo ?? d0.cumprimento_ativo,
    cumprimento_encerrado:
      patch.cumprimento_encerrado ??
      target?.cumprimento_encerrado ??
      d0.cumprimento_encerrado,
    datajud_encerrado_tribunal:
      patch.datajud_encerrado_tribunal ??
      target?.datajud_encerrado_tribunal ??
      d0.datajud_encerrado_tribunal,
  };

  const ja_ativo = !!(
    merged.em_cumprimento_sentenca ||
    merged.cumprimento_ativo ||
    String(merged.status_executivo || dP.status_executivo || "").toLowerCase() === "ativo"
  );

  let fase: any = {};
  let diasParado = 0;
  let estado: EstadoParado = "sem_scan";
  let score = 0;
  let acionavel = false;

  try {
    fase = detectFlagsFase(merged as any);
    const ult = ultimaDataTribunal(merged as any);
    diasParado =
      ult.date != null
        ? Math.max(0, Math.floor((Date.now() - ult.date.getTime()) / 86400000))
        : 0;
    estado = !ult.temSinalTribunal
      ? "sem_scan"
      : ult.fonte === "datajud" || ult.fonte === "djen" || ult.fonte === "evento"
        ? "parado_confirmado"
        : "parado_provavel";
    score = scoreAcaoParado(diasParado, null, merged as any, estado);
    acionavel = aindaDaParaAgirNoProcesso(merged as any);
  } catch {
    /* motor best-effort */
  }

  const cumprimentoRecebido = !!fase?.cumprimentoRecebido;
  const falta_instaurar =
    !ja_ativo &&
    !cumprimentoRecebido &&
    !merged.cumprimento_encerrado &&
    !!(
      merged.cumprimento_pendente_necessario ||
      (merged.is_procedente && !merged.em_cumprimento_sentenca) ||
      (merged.datajud_encerrado_tribunal &&
        merged.is_procedente &&
        !merged.em_cumprimento_sentenca)
    );

  const motor_parados = {
    em: new Date().toISOString(),
    dias_parado_tribunal: diasParado,
    estado,
    score_acao: score,
    acionavel,
    fase: {
      cumprimentoAberto: !!fase?.cumprimentoAberto,
      cumprimentoRecebido,
      temSentenca: !!fase?.temSentenca,
      replicaPendente: !!fase?.replicaPendente,
    },
    falta_instaurar_cumprimento: falta_instaurar,
    via: "motor_parados_instaurar",
  };

  return { motor_parados, falta_instaurar, ja_ativo };
}

/** Mescla motor no patch (mutável). */
export function mergeMotorParadosIntoPatch(
  target: any,
  patch: Record<string, any>
): Record<string, any> {
  const { motor_parados, falta_instaurar, ja_ativo } = applyMotorParadosInstaurar(
    target,
    patch
  );
  const dadosBase =
    patch.dados && typeof patch.dados === "object" ? { ...patch.dados } : {};
  dadosBase.motor_parados = motor_parados;
  dadosBase.falta_instaurar_cumprimento = falta_instaurar;
  dadosBase.parados_score_acao = motor_parados.score_acao;
  dadosBase.parados_dias_tribunal = motor_parados.dias_parado_tribunal;

  if (falta_instaurar && !ja_ativo) {
    patch.cumprimento_pendente_necessario = true;
    dadosBase.cumprimento_pendente_necessario = true;
    const st = String(dadosBase.status_executivo || "").toLowerCase();
    if (!st || st === "nenhum" || st === "procedente") {
      dadosBase.status_executivo = "pendente";
    }
  }

  patch.dados = dadosBase;
  return patch;
}

/**
 * Lote A — uma leitura só das flags. processarCaso e testes usam isto.
 */
import type { LegalCase } from "./case-logic";
import { isBuscaApreensaoReal } from "./ba-real";
import {
  classifyMeritoFromText,
  isDataAposRetorno,
} from "./merito-detect";

function blob(c: Partial<LegalCase> & Record<string, any>): string {
  return [
    c.evento_resumo,
    c.datajud_ultimo_nome,
    c.djen_ultimo_resumo,
    c.classe_processual,
    c.classe,
    c.classe_acao,
  ]
    .filter(Boolean)
    .join(" ");
}

export function extractClasseProcessual(c: Partial<LegalCase> & Record<string, any>): string {
  return String(
    c.classe_processual ||
      c.datajud_classe ||
      c.classe_acao ||
      c.classe ||
      c.classeProcessual ||
      ""
  )
    .replace(/\s+/g, " ")
    .trim();
}

export function isCumprimentoRecebidoTruth(c: Partial<LegalCase> & Record<string, any>): boolean {
  if (c.cumprimento_satisfeito === true || c.alvara_levantado === true || c.cumprimento_encerrado === true) {
    return true;
  }
  const txt = blob(c).toUpperCase();
  return (
    /ALVAR[AÁ]\s+(EXPEDIDO|LEVANTADO|CUMPRIDO)/.test(txt) ||
    /LEVANTAMENTO\s+(REALIZADO|EFETUADO|DE\s+VALORES)/.test(txt) ||
    /VALORES?\s+(RECEBIDOS?|LEVANTADOS?)/.test(txt) ||
    /QUITA[CÇ][AÃ]O/.test(txt) ||
    /OBRIGA[CÇ][AÃ]O\s+SATISFEITA/.test(txt) ||
    /CUMPRIMENTO\s+(INTEGRAL|SATISFEITO|HOMOLOGADO)/.test(txt) ||
    /EXTIN[CÇ][AÃ]O\s+PELO\s+PAGAMENTO/.test(txt)
  );
}

export function meritoExclusivo(c: Partial<LegalCase> & Record<string, any>): {
  is_procedente: boolean;
  is_improcedente: boolean;
  is_parcial: boolean;
  evento_tipo: string | undefined;
} {
  const text = classifyMeritoFromText(blob(c));
  let is_parcial = !!text.isParcial || c.evento_tipo === "sentenca_parcial";
  let is_procedente = !!text.isProcedente || c.evento_tipo === "sentenca_procedente" || c.is_procedente === true;
  let is_improcedente =
    !!text.isImprocedente || c.evento_tipo === "sentenca_improcedente" || c.is_improcedente === true;

  if (is_parcial) {
    is_procedente = false;
    is_improcedente = false;
  } else if (text.isProcedente && !text.isImprocedente) {
    is_procedente = true;
    is_improcedente = false;
  } else if (text.isImprocedente && !text.isProcedente) {
    is_improcedente = true;
    is_procedente = false;
  } else if (is_procedente && is_improcedente) {
    is_procedente = false;
    is_improcedente = false;
  }

  let evento_tipo = String(c.evento_tipo || "") || undefined;
  if (is_parcial) evento_tipo = "sentenca_parcial";
  else if (is_procedente && evento_tipo?.startsWith("sentenca")) evento_tipo = "sentenca_procedente";
  else if (is_improcedente && evento_tipo?.startsWith("sentenca")) evento_tipo = "sentenca_improcedente";

  return { is_procedente, is_improcedente, is_parcial, evento_tipo };
}

export function replicaPendenteTruth(c: Partial<LegalCase> & Record<string, any>): boolean {
  const txt = blob(c).toUpperCase();
  const temContestacao = /CONTESTA/.test(txt) && !/PRAZO\s+(PARA\s+)?(A\s+)?CONTESTA/.test(txt);
  const temReplica = /R[EÉ]PLICA/.test(txt) && !/PRAZO\s+(PARA\s+)?(A\s+)?R[EÉ]PLICA/.test(txt);
  const temSentenca = /SENTEN[CÇ]A|JULGO\s+(IM)?PROCEDENTE/.test(txt) || String(c.evento_tipo || "").startsWith("sentenca");
  return temContestacao && !temReplica && !temSentenca;
}

export function novidadeAposRetorno(c: Partial<LegalCase> & Record<string, any>): boolean {
  const raw = !!(c.tem_atualizacao_pos_retorno || c.djen_nova_comunicacao || c.tem_novo_andamento);
  if (!raw) return false;
  const when = c.evento_data || c.datajud_ultimo_movimento || c.djen_ultima_data;
  return isDataAposRetorno(when, c.ultimoRetorno || c.ultimo_retorno);
}

export function eventoTipoEstavel(c: Partial<LegalCase> & Record<string, any>, baReal: boolean): string | undefined {
  const encerrado = !!(c.datajud_encerrado_tribunal || String(c.evento_tipo || "").includes("transito") || String(c.evento_tipo || "").includes("baixa"));
  if (encerrado) return "transito_ou_baixa";
  if (c.evento_tipo === "ba" && !baReal) return "rotina";
  if (baReal && !encerrado) return c.evento_tipo === "ba" ? "ba" : c.evento_tipo;
  return c.evento_tipo;
}

export function applyFlagsTruth<T extends Partial<LegalCase> & Record<string, any>>(c: T): T {
  const classe_processual = extractClasseProcessual(c);
  const withClasse = { ...c, classe_processual };
  const ba = isBuscaApreensaoReal(withClasse as any);
  const merito = meritoExclusivo(withClasse);
  const recebido = isCumprimentoRecebidoTruth(withClasse);
  const aberto = recebido
    ? false
    : !!(c.em_cumprimento_sentenca || c.cumprimento_ativo || c.cumprimento_pendente_necessario);
  const encerrado = !!(c.datajud_encerrado_tribunal);
  const evento_tipo = eventoTipoEstavel({ ...withClasse, ...merito }, ba && !encerrado);

  return {
    ...c,
    classe_processual,
    indicio_busca_apreensao: ba && !encerrado,
    is_procedente: merito.is_procedente,
    is_improcedente: merito.is_improcedente,
    em_cumprimento_sentenca: aberto,
    cumprimento_encerrado: recebido,
    cumprimento_ativo: aberto,
    replica_pendente: replicaPendenteTruth(withClasse),
    tem_novo_andamento: novidadeAposRetorno(c),
    tem_atualizacao_pos_retorno: novidadeAposRetorno(c) ? c.tem_atualizacao_pos_retorno : false,
    evento_tipo: evento_tipo as any,
  };
}

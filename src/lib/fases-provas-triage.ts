/**
 * Triagem de réplicas/provas: usa SOMENTE o último movimento DataJud, a última
 * publicação DJEN e os registros da carteira. Nunca inventa protocolo, prazo
 * judicial aberto ou autorização para cobrança.
 */
import { isCasoEncerrado } from "@/lib/status-encerrado";

export type CaseRecord = Record<string, unknown>;
export type TriageKind = "replica" | "provas";
export type EvidenceLevel = "tribunal" | "cadastro" | "mencao";
export type TriageCategory = "intimacao" | "enviado" | "pericia" | "decisao" | "pendencia" | "referencia";
export type TriagePriority = "alta" | "media" | "baixa";

export type TriageRow = {
  key: string;
  cnj: string;
  cliente: string;
  advogado: string;
  escritorio: string;
  tribunal: string;
  status: string;
  tipo: TriageKind;
  fase: string;
  categoria: TriageCategory;
  nivel: EvidenceLevel;
  prioridade: TriagePriority;
  fonte: string;
  evidencia: string;
  acao: string;
  motivo: string;
  proximoRetorno: string;
  dataMovimento: string;
  datajud: string;
  djen: string;
  linkDjen: string;
  registroInterno: string;
  datajudUltimoNome: string;
  djenUltimoResumo: string;
};

export const normalizePhaseText = (v: unknown) =>
  String(v ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

export function formatFasesDate(value: unknown): string {
  if (!value) return "Sem registro";
  const raw = String(value);
  // Datas sem horário são datas de calendário: converter para o fuso de
  // São Paulo com new Date("YYYY-MM-DD") faria recuar um dia.
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const [year, month, day] = raw.split("-");
    return day + "/" + month + "/" + year;
  }
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return raw.slice(0, 10);
  return date.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
}

function eventTime(raw: string): number {
  if (!raw) return 0;
  const br = /^(\d{2})\/(\d{2})\/(\d{4})/.exec(raw);
  if (br) return Date.UTC(Number(br[3]), Number(br[2])-1, Number(br[1]));
  const time = new Date(raw).getTime();
  return Number.isFinite(time) ? time : 0;
}
function snippet(value: unknown, max = 260): string {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  return text.length > max ? text.slice(0, max - 1) + "…" : text;
}
function valueOf(item: CaseRecord, ...keys: string[]): string {
  for (const k of keys) {
    const value = item[k];
    if (value !== null && value !== undefined && String(value).trim()) return String(value);
  }
  return "";
}
function isAboutType(text: string, tipo: TriageKind): boolean {
  const n = normalizePhaseText(text);
  return tipo === "replica"
    ? /\breplica\b|impugnacao (?:a|da) contestacao/.test(n)
    : /\bprovas?\b|\bpericia\b|\bpericial\b|\blaudo\b|\binstrucao probatoria\b|especificacao de provas/.test(n);
}

const decision = /\bsentenca\b|improceden|proceden|transito em julgado|extincao do processo|arquivamento definitivo|baixa definitiva|cumprimento de sentenca/;
const request = /\bintimad[oa]s?\b|\bintimacao\b|\bdetermin[ao]c?a?o?\b|\bdespacho\b|\bprazo para\b|\bprazo de\b|\bespecificacao de provas|\bmanifestar.s? sobre\b|\bapresentar\b|\bjuntar\b|\brequer[ae]r\b|\bproduzir\b/;
const sent = /\bprotocolad[ao]s?\b|\bapresentad[ao]s?\b|\bjuntad[ao]s?\b|\bentregu[ae]s?\b|\brealizad[ao]s?\b|\benviad[ao]s?\b/;
const pending = /\bpendente\b|\baguardand[oa]\b|\bprovidenciar\b|\bsolicitar\b|\bprecisa\b|\bfalta\b|\bnao apresentad[ao]\b|\bprazo decorrid[ao]\b|\bperda de prazo\b/;
const negative = /\b(?:nao|nunca)\b.{0,40}\b(?:apresentad[ao]s?|protocolad[ao]s?|juntad[ao]s?|enviad[ao]s?|realizad[ao]s?)\b/;

type Finding = Pick<TriageRow, "fase" | "categoria" | "prioridade" | "acao" | "motivo">;
function findingFor(text: string, tipo: TriageKind, source: EvidenceLevel): Finding {
  const n = normalizePhaseText(text);
  const isReplica = tipo === "replica";
  if (decision.test(n)) return {
    fase: "Movimento posterior à etapa",
    categoria: "decisao",
    prioridade: "media",
    acao: "Ler a decisão e atualizar a fase da carteira.",
    motivo: "O último registro consultado menciona uma decisão ou etapa posterior. Isso não demonstra que o processo inteiro acabou.",
  };
  if (negative.test(n) || /\bprazo decorrid[ao]\b|\bperda de prazo\b/.test(n)) return {
    fase: "Ausência ou decurso anotado",
    categoria: "pendencia",
    prioridade: "alta",
    acao: isReplica ? "Verificar o protocolo da réplica e eventual certidão de decurso." : "Verificar se as provas foram apresentadas e se existe prazo encerrado.",
    motivo: "O registro menciona ausência ou decurso. Não equivale à confirmação de perda de prazo pelo tribunal.",
  };
  if (!isReplica && /\b(?:pericia|pericial|perito|laudo)\b/.test(n)) {
    const entregue = sent.test(n) && !negative.test(n);
    return {
      fase: entregue ? "Laudo ou perícia com registro de juntada" : "Perícia / laudo mencionado",
      categoria: "pericia",
      prioridade: entregue ? "media" : "alta",
      acao: entregue ? "Verificar se haverá manifestação sobre o laudo." : "Identificar responsável, data e próxima providência da perícia.",
      motivo: source === "tribunal" ? "O movimento consultado menciona a perícia; não comprova, sozinho, prazo de manifestação vigente." : "Informação encontrada no cadastro; verificar o andamento oficial se for necessária uma decisão jurídica.",
    };
  }

  // Menção genérica a "juntada de petição" NÃO comprova que eram provas/réplica.
  const envioEspecifico = sent.test(n) && isAboutType(n, tipo);
  if (envioEspecifico) return {
    fase: source === "tribunal" ? "Juntada / apresentação mencionada no tribunal" : "Envio informado no cadastro",
    categoria: "enviado",
    prioridade: "media",
    acao: isReplica ? "Consultar a petição apresentada e acompanhar o despacho seguinte." : "Conferir quais documentos foram juntados e a próxima manifestação.",
    motivo: source === "tribunal" ? "O último ato registrado contém referência explícita à apresentação; a natureza do documento e a fase vigente ainda dependem do teor." : "A anotação informa o envio; não há comprovante de protocolo verificado nesta triagem.",
  };
  if (request.test(n) && isAboutType(n, tipo)) return {
    fase: source === "tribunal" ? "Intimação / determinação identificada" : "Providência solicitada no cadastro",
    categoria: "intimacao",
    prioridade: "alta",
    acao: isReplica ? "Abrir a intimação, conferir a data e organizar a réplica com o advogado." : "Ler a intimação e listar documentos ou provas que foram solicitados.",
    motivo: source === "tribunal" ? "Há ato específico no último registro oficial consultado. O prazo atual não é calculado nem confirmado por esta triagem." : "O cadastro menciona providência; confira se há intimação oficial correspondente.",
  };
  if (pending.test(n) && isAboutType(n, tipo)) return {
    fase: isReplica ? "Réplica pendente no cadastro" : "Provas / documentos pendentes no cadastro",
    categoria: "pendencia",
    prioridade: "alta",
    acao: isReplica ? "Localizar a contestação, a intimação e o comprovante de protocolo." : "Identificar os documentos faltantes e conferir o prazo com o advogado.",
    motivo: "Pendência descrita internamente, não confirmada automaticamente como prazo judicial aberto.",
  };
  return {
    fase: isReplica ? "Réplica citada no histórico" : "Provas citadas no histórico",
    categoria: "referencia",
    prioridade: "baixa",
    acao: isReplica ? "Verificar o último ato antes de incluir na fila de réplica." : "Identificar se a referência exige alguma providência atual.",
    motivo: "A palavra aparece no registro, sem um ato específico de envio, intimação ou pendência.",
  };
}

export function classifyFasesProvas(cases: CaseRecord[], seen = new Set<string>()): TriageRow[] {
  const rows: TriageRow[] = [];
  for (const item of cases) {
    if (isCasoEncerrado(item)) continue;
    const status = valueOf(item, "situacao", "status_interno", "status") || "Sem situação cadastrada";
    const cnj = valueOf(item, "protocolo", "protocolo_ref").trim();
    const recordId = valueOf(item, "id", "db_id");
    const keyBase = cnj.replace(/\D/g, "") || recordId;
    if (!keyBase) continue;
    const note = valueOf(item, "observacao", "observacoes");
    const datajud = valueOf(item, "datajud_ultimo_nome");
    const djen = valueOf(item, "djen_ultimo_resumo");
    const tribunalEvents = [
      { text: datajud, source: "DataJud · último movimento", date: valueOf(item, "datajud_ultimo_movimento", "datajud_consultado_em") },
      { text: djen, source: "DJEN · última publicação", date: valueOf(item, "djen_ultima_data", "djen_consultado_em") },
    ].sort((a, b) => eventTime(b.date) - eventTime(a.date));
    for (const tipo of ["replica", "provas"] as const) {
      if (![note, datajud, djen].some(text => isAboutType(text, tipo))) continue;
      const key = keyBase + ":" + tipo;
      if (seen.has(key)) continue;
      seen.add(key);
      // O registro oficial mais recente e relevante prevalece sobre anotações
      // antigas. Um ato posterior só desloca a fase se for realmente mais novo.
      const official = tribunalEvents.find(event =>
        decision.test(normalizePhaseText(event.text)) || isAboutType(event.text, tipo));
      const evidence = official || (isAboutType(note, tipo)
        ? { text: note, source: "Cadastro · observação", date: "" }
        : { text: "", source: "Sem trecho disponível", date: "" });
      const nivel: EvidenceLevel = official ? "tribunal" : "cadastro";
      const finding = findingFor(evidence.text, tipo, nivel);
      const realLevel: EvidenceLevel = finding.categoria === "referencia" ? "mencao" : nivel;
      rows.push({
        key, cnj,
        cliente: valueOf(item, "cliente") || "Cliente não informado",
        advogado: valueOf(item, "advogado") || "Não atribuído",
        escritorio: valueOf(item, "escritorio"),
        tribunal: valueOf(item, "tribunal"),
        status,
        tipo,
        ...finding,
        nivel: realLevel,
        fonte: evidence.source,
        evidencia: snippet(evidence.text),
        proximoRetorno: valueOf(item, "proximoPrazo", "proximo_retorno"),
        dataMovimento: evidence.date ? formatFasesDate(evidence.date) : "Sem registro",
        datajud: formatFasesDate(item.datajud_consultado_em),
        djen: formatFasesDate(item.djen_consultado_em),
        linkDjen: /^https:\/\//i.test(valueOf(item, "djen_ultimo_link")) ? valueOf(item, "djen_ultimo_link") : "",
        registroInterno: snippet(note, 650),
        datajudUltimoNome: snippet(datajud, 350),
        djenUltimoResumo: snippet(djen, 350),
      });
    }
  }
  return rows;
}

export const priorityOrder: Record<TriagePriority, number> = { alta: 0, media: 1, baixa: 2 };
export function sortTriageRows(rows: TriageRow[]): TriageRow[] {
  return [...rows].sort((a, b) =>
    priorityOrder[a.prioridade] - priorityOrder[b.prioridade] ||
    a.cliente.localeCompare(b.cliente, "pt-BR") ||
    a.tipo.localeCompare(b.tipo));
}

export function excelSafeCell(value: unknown): string {
  const raw = String(value ?? "").replace(/\u0000/g, "").slice(0, 4000);
  // Excel treats strings beginning in formula markers as potential formula cells.
  return /^[\s]*[=+\-@\t\r]/.test(raw) ? "'" + raw : raw;
}

export function exportTriageRow(row: TriageRow): string[] {
  return [
    row.cliente, row.cnj, row.tipo === "replica" ? "Réplica" : "Provas",
    row.fase, row.nivel === "tribunal" ? "Ato registrado no tribunal" : row.nivel === "cadastro" ? "Registro interno" : "Menção",
    row.prioridade === "alta" ? "Prioridade alta" : row.prioridade === "media" ? "Prioridade média" : "Prioridade baixa",
    row.acao, row.motivo, row.fonte, row.evidencia, row.dataMovimento,
    row.status, row.advogado, row.escritorio, row.tribunal, row.proximoRetorno,
    row.datajud, row.djen,
  ].map(excelSafeCell);
}
export const TRIAGE_EXPORT_HEADERS = [
  "Cliente", "CNJ", "Tipo", "Situação identificada", "Base da informação",
  "Prioridade", "Próxima ação", "Por que esta classificação", "Fonte",
  "Trecho da evidência", "Data do ato consultado", "Situação na carteira",
  "Advogado", "Escritório", "Tribunal", "Próximo retorno cadastrado (não é prazo judicial)",
  "Data da consulta DataJud", "Data da consulta DJEN",
];
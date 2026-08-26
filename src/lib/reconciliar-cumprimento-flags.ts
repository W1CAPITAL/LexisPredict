/**
 * Reconciliação de flags de cumprimento — Lote 3
 * Corrige inconsistências típicas:
 * - "ativo" sem movimento de cumprimento / sem sentença
 * - pendente + ativo ao mesmo tempo
 * - encerrado arquivado tratado como ativo
 * - procedência recente não refletida em is_procedente
 */

export type FlagsCumprimentoInput = {
  cumprimento_pendente_necessario?: boolean | null;
  em_cumprimento_sentenca?: boolean | null;
  cumprimento_ativo?: boolean | null;
  cumprimento_encerrado?: boolean | null;
  status_executivo?: string | null;
  is_procedente?: boolean | null;
  dados?: Record<string, unknown> | null;
  /** textos livres para heurística */
  blob?: string | null;
  data_transito_julgado?: string | null;
  data_sentenca?: string | null;
};

export type StatusExecutivo =
  | "pendente"
  | "ativo"
  | "encerrado"
  | "procedente"
  | "outro";

export type FlagsReconciliadas = {
  status_executivo: StatusExecutivo;
  is_procedente: boolean;
  cumprimento_pendente_necessario: boolean;
  em_cumprimento_sentenca: boolean;
  cumprimento_ativo: boolean;
  cumprimento_encerrado: boolean;
  motivos: string[];
};

const RE_CUMPRIMENTO_ATIVO = [
  /cumprimento\s+de\s+senten[cç]a/i,
  /instaurad[oa]\s+o?\s*cumprimento/i,
  /fase\s+de\s+cumprimento/i,
  /execu[cç][aã]o\s+de\s+senten[cç]a/i,
  /penhora/i,
  /mandado\s+de\s+pagamento/i,
  /art\.?\s*523/i,
  /intim[aа][cç][aã]o\s+para\s+pagamento/i,
];

const RE_ENCERRADO = [
  /arquivad/i,
  /baixado\s+definitiv/i,
  /extin[cç][aã]o\s+(?:do\s+)?(?:processo|cumprimento)/i,
  /cumprimento\s+(?:j[aá]\s+)?encerrad/i,
  /satisfeito\s+o\s+cr[eé]dito/i,
  /pagamento\s+integral/i,
  /homologad[oa]\s+a\s+quita[cç][aã]o/i,
];

const RE_PROCEDENTE = [
  /julgo\s+(?:parcialmente\s+)?procedente/i,
  /dou\s+por\s+(?:parcialmente\s+)?procedente/i,
  /a[cç][aã]o\s+(?:parcialmente\s+)?procedente/i,
  /pedido\s+(?:parcialmente\s+)?procedente/i,
  /proced[eê]ncia\s+(?:parcial|total)/i,
];

const RE_IMPROCEDENTE = [
  /julgo\s+improcedente/i,
  /improced[eê]ncia\s+total/i,
  /pedido\s+improcedente/i,
];

const RE_SEM_SENTENCA = [
  /sem\s+resolu[cç][aã]o\s+de\s+m[eé]rito/i,
  /extin[cç][aã]o\s+sem\s+resolu[cç][aã]o/i,
  /indeferid[oa]\s+a\s+peti[cç][aã]o\s+inicial/i,
];

function blobOf(input: FlagsCumprimentoInput): string {
  if (input.blob) return String(input.blob);
  const d = input.dados || {};
  return [
    d.evento_resumo,
    d.datajud_ultimo_nome,
    d.djen_ultimo_resumo,
    d.procedente_motivo,
    d.cumprimento_sentenca_motivo,
    d.status_executivo,
  ]
    .filter(Boolean)
    .join("\n");
}

function anyMatch(text: string, res: RegExp[]): boolean {
  return res.some((re) => re.test(text));
}

/**
 * Status canônico para filtros da UI.
 */
export function reconciliarFlagsCumprimento(input: FlagsCumprimentoInput): FlagsReconciliadas {
  const motivos: string[] = [];
  const d = (input.dados && typeof input.dados === "object" ? input.dados : {}) as Record<string, any>;
  const text = blobOf(input);

  let is_procedente = !!(
    input.is_procedente ||
    d.is_procedente ||
    d.procedente ||
    d.merito_tipo === "procedente" ||
    d.merito_tipo === "parcial"
  );
  if (!is_procedente && anyMatch(text, RE_PROCEDENTE)) {
    is_procedente = true;
    motivos.push("procedência inferida do teor/movimentos");
  }
  if (anyMatch(text, RE_IMPROCEDENTE) && !anyMatch(text, RE_PROCEDENTE)) {
    is_procedente = false;
    motivos.push("improcedência no teor — não marcar procedente");
  }

  const semSentenca =
    anyMatch(text, RE_SEM_SENTENCA) ||
    !!(d.sem_sentenca || d.extinto_sem_merito);

  let cumprimento_encerrado = !!(
    input.cumprimento_encerrado ||
    d.cumprimento_encerrado ||
    String(input.status_executivo || d.status_executivo || "").toLowerCase() === "encerrado"
  );
  if (!cumprimento_encerrado && anyMatch(text, RE_ENCERRADO)) {
    cumprimento_encerrado = true;
    motivos.push("encerramento inferido do teor");
  }

  // Sinais reais de cumprimento em curso
  const sinalAtivoTeor = anyMatch(text, RE_CUMPRIMENTO_ATIVO);
  const flagAtivoBruta = !!(
    input.em_cumprimento_sentenca ||
    input.cumprimento_ativo ||
    d.em_cumprimento_sentenca ||
    d.cumprimento_ativo
  );

  // Encerrado sem sentença / arquivado: NÃO é ativo
  if (cumprimento_encerrado || semSentenca) {
    if (flagAtivoBruta) motivos.push("remove ativo: encerrado ou sem sentença");
    return {
      status_executivo: cumprimento_encerrado ? "encerrado" : is_procedente ? "procedente" : "outro",
      is_procedente,
      cumprimento_pendente_necessario: false,
      em_cumprimento_sentenca: false,
      cumprimento_ativo: false,
      cumprimento_encerrado: !!cumprimento_encerrado,
      motivos,
    };
  }

  let em_cumprimento_sentenca = flagAtivoBruta;
  // Exige sinal de teor OU flag persistida confiável; se só flag e teor fala outra coisa, duvidar
  if (flagAtivoBruta && !sinalAtivoTeor && text.length > 80) {
    // Flag órfã: texto não sustenta cumprimento ativo
    const falaArquivo = /arquiv|baix|extint/i.test(text);
    if (falaArquivo) {
      em_cumprimento_sentenca = false;
      cumprimento_encerrado = true;
      motivos.push("flag ativo vs teor de arquivamento → encerrado");
    }
  }
  if (!em_cumprimento_sentenca && sinalAtivoTeor && !cumprimento_encerrado) {
    em_cumprimento_sentenca = true;
    motivos.push("cumprimento ativo inferido do teor");
  }

  let cumprimento_pendente_necessario = !!(
    input.cumprimento_pendente_necessario ||
    d.cumprimento_pendente_necessario
  );

  // Procedente + transitado + não ativo + não encerrado → pendente de instaurar
  const temTransito = !!(input.data_transito_julgado || d.data_transito_julgado);
  if (is_procedente && !em_cumprimento_sentenca && !cumprimento_encerrado) {
    cumprimento_pendente_necessario = true;
    if (!input.cumprimento_pendente_necessario) {
      motivos.push("procedente sem cumprimento → pendente");
    }
  }

  // Conflito pendente + ativo: ativo vence se houver sinal
  if (cumprimento_pendente_necessario && em_cumprimento_sentenca) {
    cumprimento_pendente_necessario = false;
    motivos.push("conflito pendente+ativo → mantém ativo");
  }

  let status_executivo: StatusExecutivo = "outro";
  if (cumprimento_encerrado) status_executivo = "encerrado";
  else if (em_cumprimento_sentenca) status_executivo = "ativo";
  else if (cumprimento_pendente_necessario) status_executivo = "pendente";
  else if (is_procedente) status_executivo = "procedente";
  else status_executivo = "outro";

  // Status string do banco pode mentir — reconciliação manda
  const stRaw = String(input.status_executivo || d.status_executivo || "").toLowerCase();
  if (stRaw === "ativo" && status_executivo !== "ativo") {
    motivos.push(`status_executivo banco="${stRaw}" corrigido para ${status_executivo}`);
  }

  return {
    status_executivo,
    is_procedente,
    cumprimento_pendente_necessario,
    em_cumprimento_sentenca,
    cumprimento_ativo: em_cumprimento_sentenca,
    cumprimento_encerrado,
    motivos,
  };
}

/**
 * Aplica reconciliação sobre um patch de update (case-actions / scan).
 * Usado por `applyReconciliacaoAoPatch` em case-actions.ts.
 */
export function applyReconciliacaoAoPatch<T extends Record<string, any>>(
  patch: T,
  caseLike: Record<string, any> | null | undefined
): T {
  const base = caseLike || {};
  const dadosPatch =
    patch.dados && typeof patch.dados === "object" ? { ...(patch.dados as object) } : {};
  const dadosBase =
    base.dados && typeof base.dados === "object" ? { ...(base.dados as object) } : {};
  const dados = { ...dadosBase, ...dadosPatch };

  const r = reconciliarFlagsCumprimento({
    cumprimento_pendente_necessario:
      patch.cumprimento_pendente_necessario ?? base.cumprimento_pendente_necessario,
    em_cumprimento_sentenca: patch.em_cumprimento_sentenca ?? base.em_cumprimento_sentenca,
    cumprimento_ativo: patch.cumprimento_ativo ?? base.cumprimento_ativo,
    cumprimento_encerrado: patch.cumprimento_encerrado ?? base.cumprimento_encerrado,
    status_executivo: patch.status_executivo ?? base.status_executivo ?? (dados as any).status_executivo,
    is_procedente: patch.is_procedente ?? base.is_procedente,
    dados,
    blob: [
      patch.procedente_motivo ?? base.procedente_motivo,
      patch.cumprimento_sentenca_motivo ?? base.cumprimento_sentenca_motivo,
      (dados as any).evento_resumo,
      (dados as any).datajud_ultimo_nome,
      (dados as any).djen_ultimo_resumo,
    ]
      .filter(Boolean)
      .join("\n"),
    data_transito_julgado: patch.data_transito_julgado ?? base.data_transito_julgado,
    data_sentenca: (patch as any).data_sentenca ?? base.data_sentenca ?? (dados as any).data_sentenca,
  });

  const next: T = {
    ...patch,
    is_procedente: r.is_procedente,
    cumprimento_pendente_necessario: r.cumprimento_pendente_necessario,
    em_cumprimento_sentenca: r.em_cumprimento_sentenca,
    cumprimento_ativo: r.cumprimento_ativo,
    cumprimento_encerrado: r.cumprimento_encerrado,
    status_executivo: r.status_executivo,
    dados: {
      ...dados,
      status_executivo: r.status_executivo,
      flags_reconciliacao: {
        motivos: r.motivos,
        em: new Date().toISOString(),
      },
    },
  };
  return next;
}

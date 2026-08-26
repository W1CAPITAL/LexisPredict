/**
 * Funil ético do cliente — diagnóstico → extrajudicial → judicial (com gates).
 * Judicial só após termo de ciência + novo consentimento.
 */

export type FaseEtica =
  | "captacao"
  | "diagnostico"
  | "extrajudicial"
  | "aguardando_banco"
  | "relatorio_extrajudicial"
  | "consentimento_judicial"
  | "judicial"
  | "acordo_quitacao"
  | "encerrado_desistencia"
  | "encerrado_acordo"
  | "encerrado_sentenca";

export type GateEtica = {
  id: string;
  label: string;
  obrigatorio: boolean;
  ok: boolean;
};

export type EstadoFluxoEtico = {
  fase: FaseEtica;
  diagnosticoEntregue: boolean;
  extrajudicialDocumentado: boolean;
  relatorioQuinzenalCount: number;
  termoCienciaRiscosAssinado: boolean;
  consentimentoJudicialAssinado: boolean;
  contratoHonorariosAdvogadoEntregue: boolean;
  nuncaCobrouDocGratuito: boolean;
  /** ISO */
  updatedAt?: string;
};

export const FASE_LABELS: Record<FaseEtica, string> = {
  captacao: "0 · Captação ética",
  diagnostico: "1 · Diagnóstico",
  extrajudicial: "2 · Extrajudicial",
  aguardando_banco: "2b · Aguardando banco",
  relatorio_extrajudicial: "2c · Relatório extrajudicial",
  consentimento_judicial: "3a · Consentimento judicial",
  judicial: "3 · Judicial",
  acordo_quitacao: "4 · Acordo / quitação",
  encerrado_desistencia: "Encerrado · desistência",
  encerrado_acordo: "Encerrado · acordo",
  encerrado_sentenca: "Encerrado · sentença",
};

export function emptyEstadoFluxo(): EstadoFluxoEtico {
  return {
    fase: "captacao",
    diagnosticoEntregue: false,
    extrajudicialDocumentado: false,
    relatorioQuinzenalCount: 0,
    termoCienciaRiscosAssinado: false,
    consentimentoJudicialAssinado: false,
    contratoHonorariosAdvogadoEntregue: false,
    nuncaCobrouDocGratuito: true,
  };
}

export function normalizeEstadoFluxo(raw: unknown): EstadoFluxoEtico {
  const e = emptyEstadoFluxo();
  if (!raw || typeof raw !== "object") return e;
  const o = raw as Record<string, unknown>;
  return {
    ...e,
    ...o,
    fase: (typeof o.fase === "string" && o.fase in FASE_LABELS ? o.fase : e.fase) as FaseEtica,
    diagnosticoEntregue: o.diagnosticoEntregue === true,
    extrajudicialDocumentado: o.extrajudicialDocumentado === true,
    relatorioQuinzenalCount: Number(o.relatorioQuinzenalCount || 0) || 0,
    termoCienciaRiscosAssinado: o.termoCienciaRiscosAssinado === true,
    consentimentoJudicialAssinado: o.consentimentoJudicialAssinado === true,
    contratoHonorariosAdvogadoEntregue: o.contratoHonorariosAdvogadoEntregue === true,
    nuncaCobrouDocGratuito: o.nuncaCobrouDocGratuito !== false,
  };
}

/** Gates para avançar à fase judicial. */
export function gatesParaJudicial(estado: EstadoFluxoEtico): GateEtica[] {
  return [
    {
      id: "diagnostico",
      label: "Diagnóstico entregue (parecer honesto, sem garantia de êxito)",
      obrigatorio: true,
      ok: estado.diagnosticoEntregue,
    },
    {
      id: "extrajudicial",
      label: "Extrajudicial real documentado (notificação + tentativa de contato)",
      obrigatorio: true,
      ok: estado.extrajudicialDocumentado,
    },
    {
      id: "termo_riscos",
      label: "Termo de ciência de riscos assinado",
      obrigatorio: true,
      ok: estado.termoCienciaRiscosAssinado,
    },
    {
      id: "consentimento",
      label: "Novo termo de consentimento para via judicial",
      obrigatorio: true,
      ok: estado.consentimentoJudicialAssinado,
    },
    {
      id: "honorarios_adv",
      label: "Contrato de honorários do advogado entregue ao cliente",
      obrigatorio: true,
      ok: estado.contratoHonorariosAdvogadoEntregue,
    },
    {
      id: "docs_gratis",
      label: "Não cobrou documento gratuito (Registrato/CCS/IR)",
      obrigatorio: true,
      ok: estado.nuncaCobrouDocGratuito,
    },
  ];
}

export function podeAvancarJudicial(estado: EstadoFluxoEtico): boolean {
  return gatesParaJudicial(estado).every((g) => !g.obrigatorio || g.ok);
}

export function avancarFaseSegura(
  estado: EstadoFluxoEtico,
  destino: FaseEtica
): { ok: boolean; estado: EstadoFluxoEtico; erro?: string } {
  if (destino === "judicial" || destino === "consentimento_judicial") {
    if (destino === "judicial" && !podeAvancarJudicial(estado)) {
      return {
        ok: false,
        estado,
        erro: "Gates éticos incompletos — não avance para judicial sem consentimento informado",
      };
    }
  }
  return {
    ok: true,
    estado: { ...estado, fase: destino, updatedAt: new Date().toISOString() },
  };
}

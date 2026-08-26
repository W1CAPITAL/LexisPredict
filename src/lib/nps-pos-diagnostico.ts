/**
 * NPS / compreensão do contrato pós-diagnóstico.
 * Meta legítima: % de clientes que entendem o contrato (não “satisfação com vitória”).
 */

export type NpsDiagnostico = {
  /** 0–10 */
  nota: number | null;
  entendeuContrato: boolean | null;
  entendeuCustosRiscos: boolean | null;
  comentario?: string | null;
  coletadoEm?: string | null;
};

export function emptyNps(): NpsDiagnostico {
  return {
    nota: null,
    entendeuContrato: null,
    entendeuCustosRiscos: null,
    comentario: null,
    coletadoEm: null,
  };
}

export function registrarNps(input: {
  nota: number;
  entendeuContrato: boolean;
  entendeuCustosRiscos: boolean;
  comentario?: string;
}): NpsDiagnostico {
  const nota = Math.max(0, Math.min(10, Math.round(Number(input.nota) || 0)));
  return {
    nota,
    entendeuContrato: !!input.entendeuContrato,
    entendeuCustosRiscos: !!input.entendeuCustosRiscos,
    comentario: (input.comentario || "").slice(0, 500) || null,
    coletadoEm: new Date().toISOString(),
  };
}

/** Agrega respostas para métrica operacional. */
export function agregarNps(lista: NpsDiagnostico[]): {
  total: number;
  mediaNota: number | null;
  pctEntendeuContrato: number | null;
  pctEntendeuCustos: number | null;
  promotores: number;
  detratores: number;
} {
  const valid = lista.filter((n) => n.nota != null && n.coletadoEm);
  if (!valid.length) {
    return {
      total: 0,
      mediaNota: null,
      pctEntendeuContrato: null,
      pctEntendeuCustos: null,
      promotores: 0,
      detratores: 0,
    };
  }
  const notas = valid.map((n) => n.nota as number);
  const media = notas.reduce((a, b) => a + b, 0) / notas.length;
  const entC = valid.filter((n) => n.entendeuContrato === true).length;
  const entR = valid.filter((n) => n.entendeuCustosRiscos === true).length;
  return {
    total: valid.length,
    mediaNota: Math.round(media * 10) / 10,
    pctEntendeuContrato: Math.round((entC / valid.length) * 100),
    pctEntendeuCustos: Math.round((entR / valid.length) * 100),
    promotores: notas.filter((n) => n >= 9).length,
    detratores: notas.filter((n) => n <= 6).length,
  };
}

/**
 * Termo de ciência de riscos — itens que o cliente deve confirmar.
 * Persistido em dados.etica.termo_ciencia
 */

export type ItemCienciaRiscos = {
  id: string;
  texto: string;
};

export const ITENS_CIENCIA_RISCOS: ItemCienciaRiscos[] = [
  {
    id: "sem_garantia_exito",
    texto: "Entendo que não há garantia de êxito judicial nem de redução de juros.",
  },
  {
    id: "custas_cliente",
    texto: "Fui informado de que custas processuais são de minha responsabilidade se a justiça gratuita for indeferida.",
  },
  {
    id: "sucumbencia",
    texto: "Fui informado do risco de honorários de sucumbência em caso de improcedência.",
  },
  {
    id: "restricao_nome",
    texto: "Entendo que eventual restrição de nome pode permanecer até decisão/acordo formal.",
  },
  {
    id: "extrajudicial_separado",
    texto: "Entendo que a via judicial só ocorre com novo consentimento escrito após o extrajudicial.",
  },
  {
    id: "prazos_judiciario",
    texto: "Entendo que prazos dependem do Judiciário e não da empresa/assessoria.",
  },
  {
    id: "docs_gratis",
    texto: "Fui orientado de que Registrato/CCS/IR e 2ª via de contrato não são cobrados por esta empresa.",
  },
  {
    id: "advogado_identificado",
    texto: "Se houver judicial, serei informado do advogado OAB responsável e do contrato de honorários.",
  },
];

export type TermoCienciaState = {
  itens: Record<string, boolean>;
  assinadoEm?: string | null;
  assinadoPor?: string | null;
};

export function emptyTermoCiencia(): TermoCienciaState {
  const itens: Record<string, boolean> = {};
  for (const i of ITENS_CIENCIA_RISCOS) itens[i.id] = false;
  return { itens, assinadoEm: null, assinadoPor: null };
}

export function termoCienciaCompleto(t: TermoCienciaState): boolean {
  return ITENS_CIENCIA_RISCOS.every((i) => t.itens[i.id] === true);
}

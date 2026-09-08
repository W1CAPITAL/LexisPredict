/**
 * Filtros revisional alinhados a rótulos de tribunal (DJEN / PJe / DataJud).
 * Busca REAL no DJEN via palavras-chave; match local no texto/classe.
 */

export type FiltroRevisionalId =
  | "procedimento_comum_civel"
  | "acao_revisional"
  | "alienacao_fiduciaria"
  | "contratos_bancarios"
  | "busca_apreensao"
  | "cumprimento_sentenca"
  | "execucao_titulo"
  | "extinto_sem_merito"
  | "extinto_com_merito"
  | "improcedente"
  | "procedente_parcial"
  | "em_andamento";

export type TipoFiltro = "classe" | "assunto" | "resultado" | "fase";

export interface FiltroRevisional {
  id: FiltroRevisionalId;
  tipo: TipoFiltro;
  nomeTribunal: string;
  /** Query enviada à API DJEN (texto) */
  djenQuery: string;
  aliases: string[];
  defaultOn: boolean;
}

export const FILTROS_REVISIONAL: FiltroRevisional[] = [
  {
    id: "procedimento_comum_civel",
    tipo: "classe",
    nomeTribunal: "PROCEDIMENTO COMUM CÍVEL",
    djenQuery: "PROCEDIMENTO COMUM CÍVEL",
    aliases: ["procedimento comum cível", "procedimento comum civel", "procedimento comum"],
    defaultOn: true,
  },
  {
    id: "acao_revisional",
    tipo: "assunto",
    nomeTribunal: "Ação revisional de contrato bancário",
    djenQuery: "revisional de contrato",
    aliases: [
      "ação revisional", "acao revisional", "revisional de contrato",
      "revisão de contrato", "revisao de contrato", "revisional bancária", "revisional bancaria",
    ],
    defaultOn: true,
  },
  {
    id: "alienacao_fiduciaria",
    tipo: "assunto",
    nomeTribunal: "Alienação fiduciária",
    djenQuery: "alienação fiduciária",
    aliases: ["alienação fiduciária", "alienacao fiduciaria", "fidúcia", "fiducia"],
    defaultOn: true,
  },
  {
    id: "contratos_bancarios",
    tipo: "assunto",
    nomeTribunal: "Contratos bancários",
    djenQuery: "contratos bancários",
    aliases: ["contratos bancários", "contratos bancarios", "financiamento de veículo", "empréstimo consignado"],
    defaultOn: true,
  },
  {
    id: "busca_apreensao",
    tipo: "classe",
    nomeTribunal: "Busca e apreensão",
    djenQuery: "busca e apreensão",
    aliases: ["busca e apreensão", "busca e apreensao"],
    defaultOn: false,
  },
  {
    id: "cumprimento_sentenca",
    tipo: "fase",
    nomeTribunal: "Cumprimento de sentença",
    djenQuery: "cumprimento de sentença",
    aliases: ["cumprimento de sentença", "cumprimento de sentenca"],
    defaultOn: false,
  },
  {
    id: "execucao_titulo",
    tipo: "classe",
    nomeTribunal: "Execução de título extrajudicial",
    djenQuery: "execução de título extrajudicial",
    aliases: ["execução de título extrajudicial", "execucao de titulo extrajudicial"],
    defaultOn: false,
  },
  {
    id: "extinto_sem_merito",
    tipo: "resultado",
    nomeTribunal: "Extinto sem resolução do mérito",
    djenQuery: "sem resolução do mérito",
    aliases: [
      "extinto sem resolução do mérito", "extinto sem resolucao do merito",
      "extinção sem resolução do mérito", "art. 485", "artigo 485",
      "indeferido a petição inicial", "abandono de causa",
    ],
    defaultOn: false,
  },
  {
    id: "extinto_com_merito",
    tipo: "resultado",
    nomeTribunal: "Extinto com resolução do mérito",
    djenQuery: "com resolução do mérito",
    aliases: ["extinto com resolução do mérito", "art. 487", "artigo 487"],
    defaultOn: false,
  },
  {
    id: "improcedente",
    tipo: "resultado",
    nomeTribunal: "Improcedente",
    djenQuery: "julgo improcedente",
    aliases: ["improcedente", "julgo improcedente"],
    defaultOn: false,
  },
  {
    id: "procedente_parcial",
    tipo: "resultado",
    nomeTribunal: "Procedente em parte",
    djenQuery: "parcialmente procedente",
    aliases: ["procedente em parte", "parcialmente procedente", "julgo parcialmente procedente"],
    defaultOn: false,
  },
  {
    id: "em_andamento",
    tipo: "fase",
    nomeTribunal: "Em andamento",
    djenQuery: "intimação",
    aliases: ["em andamento", "em tramitação", "intimação", "intimacao"],
    defaultOn: false,
  },
];

export function filtrosDefaultOn(): FiltroRevisionalId[] {
  return FILTROS_REVISIONAL.filter((f) => f.defaultOn).map((f) => f.id);
}

export function normMatch(s: string): string {
  return String(s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function matchFiltrosRevisional(
  texto: string,
  ativos: FiltroRevisionalId[]
): { ok: boolean; hits: FiltroRevisionalId[] } {
  const n = normMatch(texto);
  if (!n) return { ok: false, hits: [] };
  const hits: FiltroRevisionalId[] = [];
  for (const f of FILTROS_REVISIONAL) {
    if (!ativos.includes(f.id)) continue;
    const names = [f.nomeTribunal, f.djenQuery, ...f.aliases].map(normMatch);
    if (names.some((a) => a && n.includes(a))) hits.push(f.id);
  }
  return { ok: hits.length > 0, hits };
}

/** Extrai CNJ 20 dígitos do texto/campo */
export function extractCnjDigits(raw: string | null | undefined): string | null {
  const d = String(raw || "").replace(/\D/g, "");
  if (d.length === 20) return d;
  const m = String(raw || "").match(/\d{7}-?\d{2}\.?\d{4}\.?\d\.?\d{2}\.?\d{4}/);
  if (!m) return null;
  const x = m[0].replace(/\D/g, "");
  return x.length === 20 ? x : null;
}

export function formatCnjMasked(digits: string): string {
  const x = digits.replace(/\D/g, "").slice(0, 20);
  if (x.length !== 20) return x;
  return `${x.slice(0, 7)}-${x.slice(7, 9)}.${x.slice(9, 13)}.${x.slice(13, 14)}.${x.slice(14, 16)}.${x.slice(16, 20)}`;
}

/** Nome completo real: destinatários API ou regex no teor */
export function extractNomeCompletoFromDjen(item: {
  texto?: string | null;
  destinatarios?: Array<{ nome?: string; polo?: string }> | null;
}): string {
  const dest = item.destinatarios || [];
  const ativo = dest.find((d) => /ativ|autor|requerente|exequente/i.test(String(d.polo || "")));
  if (ativo?.nome && String(ativo.nome).trim().length >= 5) {
    return cleanNome(String(ativo.nome));
  }
  const anyPf = dest.find((d) => d.nome && !/banco|s\/a|ltda|finan/i.test(String(d.nome)));
  if (anyPf?.nome) return cleanNome(String(anyPf.nome));

  const text = String(item.texto || "");
  const patterns = [
    /(?:AUTOR|REQUERENTE|EXEQUENTE|RECLAMANTE)\s*[:\-–]\s*([A-ZÁÉÍÓÚÂÊÔÃÕÇ][A-ZÁÉÍÓÚÂÊÔÃÕÇa-záéíóúâêôãõç\s\.]{5,80}?)(?:\s{2,}|\s+ADVOGADO|\s+R[EÉ]U|\s+REQUERID|\n|$)/i,
    /(?:NOME\s+DO\s+AUTOR)\s*[:\-–]\s*([A-ZÁÉÍÓÚÂÊÔÃÕÇ][A-ZÁÉÍÓÚÂÊÔÃÕÇa-záéíóúâêôãõç\s\.]{5,80})/i,
  ];
  for (const re of patterns) {
    const m = text.match(re);
    if (m?.[1]) return cleanNome(m[1]);
  }
  return "";
}

function cleanNome(raw: string): string {
  let s = String(raw || "").replace(/\s+/g, " ").trim();
  s = s.split(/\s+(?:ADVOGADO|OAB|R[EÉ]U|REQUERID|INTIMAD|FICA\s)/i)[0].trim();
  // Title-ish: keep as published (often ALL CAPS from DJEN)
  if (s.length > 90) s = s.slice(0, 90).trim();
  return s;
}

export interface ProcessoDjenReal {
  processo: string;
  nome_completo: string;
  classe: string;
  assunto_ou_teor: string;
  situacao_hint: string;
  tribunal: string;
  data: string;
  link: string;
  filtros: string;
}

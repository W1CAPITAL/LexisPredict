/**
 * Filtros revisionais + higiene DJEN (sigilo, CNJ inválido, sem link).
 */

export type FiltroRevisionalId =
  | "procedimento_comum_civel"
  | "acao_revisional"
  | "alienacao_fiduciaria"
  | "contratos_bancarios"
  | "busca_apreensao"
  | "cumprimento_sentenca"
  | "extinto_sem_merito"
  | "extinto_com_merito"
  | "improcedente"
  | "procedente_parcial";

export type TipoFiltro = "classe" | "assunto" | "resultado" | "fase";

export interface FiltroRevisional {
  id: FiltroRevisionalId;
  tipo: TipoFiltro;
  nomeTribunal: string;
  /** Query DJEN — termos que o Comunica realmente indexa */
  djenQuery: string;
  aliases: string[];
  defaultOn: boolean;
}

export const FILTROS_REVISIONAL: FiltroRevisional[] = [
  {
    id: "procedimento_comum_civel",
    tipo: "classe",
    nomeTribunal: "PROCEDIMENTO COMUM CÍVEL",
    djenQuery: "PROCEDIMENTO COMUM CÍVEL revisional",
    aliases: ["procedimento comum cível", "procedimento comum civel", "procedimento comum"],
    defaultOn: true,
  },
  {
    id: "acao_revisional",
    tipo: "assunto",
    nomeTribunal: "Ação revisional de contrato bancário",
    djenQuery: "ação revisional de contrato",
    aliases: [
      "ação revisional", "acao revisional", "revisional de contrato",
      "revisão de cláusulas contratuais", "revisao de clausulas",
    ],
    defaultOn: true,
  },
  {
    id: "alienacao_fiduciaria",
    tipo: "assunto",
    nomeTribunal: "Alienação fiduciária",
    djenQuery: "alienação fiduciária financiamento",
    aliases: ["alienação fiduciária", "alienacao fiduciaria"],
    defaultOn: true,
  },
  {
    id: "contratos_bancarios",
    tipo: "assunto",
    nomeTribunal: "Contratos bancários",
    djenQuery: "contratos bancários revisional",
    aliases: ["contratos bancários", "contratos bancarios", "direito bancário"],
    defaultOn: false,
  },
  {
    id: "busca_apreensao",
    tipo: "classe",
    nomeTribunal: "Busca e apreensão",
    djenQuery: "busca e apreensão alienação fiduciária",
    aliases: ["busca e apreensão", "busca e apreensao"],
    defaultOn: false,
  },
  {
    id: "cumprimento_sentenca",
    tipo: "fase",
    nomeTribunal: "Cumprimento de sentença",
    djenQuery: "cumprimento de sentença revisional",
    aliases: ["cumprimento de sentença", "cumprimento de sentenca"],
    defaultOn: false,
  },
  {
    id: "extinto_sem_merito",
    tipo: "resultado",
    nomeTribunal: "Extinto sem resolução do mérito",
    djenQuery: "extinto sem resolução do mérito art. 485",
    aliases: [
      "sem resolução do mérito", "sem resolucao do merito",
      "extinção sem resolução", "art. 485", "artigo 485",
    ],
    defaultOn: false,
  },
  {
    id: "extinto_com_merito",
    tipo: "resultado",
    nomeTribunal: "Extinto com resolução do mérito",
    djenQuery: "extinto com resolução do mérito art. 487",
    aliases: ["com resolução do mérito", "art. 487", "artigo 487"],
    defaultOn: false,
  },
  {
    id: "improcedente",
    tipo: "resultado",
    nomeTribunal: "Improcedente",
    djenQuery: "julgo improcedente o pedido revisional",
    aliases: ["improcedente", "julgo improcedente"],
    defaultOn: false,
  },
  {
    id: "procedente_parcial",
    tipo: "resultado",
    nomeTribunal: "Procedente em parte",
    djenQuery: "parcialmente procedente revisional",
    aliases: ["procedente em parte", "parcialmente procedente"],
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

/** DV CNJ Res. 65 — rejeita número inventado / truncado */
export function cnjDvValido(digits20: string): boolean {
  const d = String(digits20 || "").replace(/\D/g, "");
  if (d.length !== 20) return false;
  if (/^0+$/.test(d)) return false;
  const seq = d.slice(0, 7);
  const dv = d.slice(7, 9);
  const rest = d.slice(9); // ano(4)+j(1)+tr(2)+origem(4) = 11
  if (rest.length !== 11) return false;
  try {
    const base = BigInt(seq + rest);
    const calc = String(98n - (base % 97n)).padStart(2, "0");
    return calc === dv;
  } catch {
    return false;
  }
}

export function extractCnjFromApiField(raw: string | null | undefined): string | null {
  const d = String(raw || "").replace(/\D/g, "");
  if (d.length === 20 && cnjDvValido(d)) return d;
  return null;
}

/** Só usa texto se houver CNJ mascarado completo com DV ok */
export function extractCnjFromTextoStrict(text: string): string | null {
  const re = /\b(\d{7})-(\d{2})\.(\d{4})\.(\d)\.(\d{2})\.(\d{4})\b/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const d = `${m[1]}${m[2]}${m[3]}${m[4]}${m[5]}${m[6]}`;
    if (cnjDvValido(d)) return d;
  }
  return null;
}

export function formatCnjMasked(digits: string): string {
  const x = digits.replace(/\D/g, "").slice(0, 20);
  if (x.length !== 20) return x;
  return `${x.slice(0, 7)}-${x.slice(7, 9)}.${x.slice(9, 13)}.${x.slice(13, 14)}.${x.slice(14, 16)}.${x.slice(16, 20)}`;
}

const SIGILO_RE =
  /segredo\s+de\s+justi[cç]a|segredo\s+justi[cç]a|processo\s+em\s+sigilo|sigilo\s+de\s+justi[cç]a|em\s+segredo|justi[cç]a\s+sigilosa|conte[uú]do\s+sigiloso|indispon[ií]vel\s+por\s+sigilo|autos?\s+em\s+sigilo|protegido\s+por\s+sigilo/i;

export function isSegredoOuSigilo(blob: string): boolean {
  return SIGILO_RE.test(String(blob || ""));
}

/** Texto inútil / capa vazia típica de sigilo ou lixo */
export function teorConsultavel(texto: string | null | undefined): boolean {
  const t = String(texto || "").replace(/\s+/g, " ").trim();
  if (t.length < 40) return false;
  if (isSegredoOuSigilo(t)) return false;
  if (/^\s*processo\s+n/i.test(t) && t.length < 80) return false;
  return true;
}

export function extractNomeCompletoFromDjen(item: {
  texto?: string | null;
  destinatarios?: Array<{ nome?: string; polo?: string }> | null;
}): string {
  const dest = item.destinatarios || [];
  const ativo = dest.find((d) => /ativ|autor|requerente|exequente/i.test(String(d.polo || "")));
  if (ativo?.nome && String(ativo.nome).trim().length >= 5 && !/banco|s\/a|ltda/i.test(ativo.nome)) {
    return cleanNome(String(ativo.nome));
  }
  const anyPf = dest.find(
    (d) => d.nome && String(d.nome).trim().length >= 8 && !/banco|s\/a|ltda|finan|credito|crédito/i.test(String(d.nome))
  );
  if (anyPf?.nome) return cleanNome(String(anyPf.nome));

  const text = String(item.texto || "");
  const patterns = [
    /(?:AUTOR|REQUERENTE|EXEQUENTE|RECLAMANTE)\s*[:\-–]\s*([A-ZÁÉÍÓÚÂÊÔÃÕÇ][A-ZÁÉÍÓÚÂÊÔÃÕÇa-záéíóúâêôãõç'\s\.]{6,90}?)(?:\s{2,}|\s+ADVOGADO|\s+R[EÉ]U|\s+REQUERID|\n|$)/i,
  ];
  for (const re of patterns) {
    const m = text.match(re);
    if (m?.[1] && !/banco|s\/a/i.test(m[1])) return cleanNome(m[1]);
  }
  return "";
}

function cleanNome(raw: string): string {
  let s = String(raw || "").replace(/\s+/g, " ").trim();
  s = s.split(/\s+(?:ADVOGADO|OAB|R[EÉ]U|REQUERID|INTIMAD|FICA\s)/i)[0].trim();
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
  consultavel: boolean;
}

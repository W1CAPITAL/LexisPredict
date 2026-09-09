/**
 * Filtros DJEN revisional — 2 grupos:
 *  F1 STATUS  → situação processual (extinto / ativo / encerrado)
 *  F2 MATÉRIA → classe / assunto / fase
 *
 * Regra: (F1 vazio OU casa ≥1 status) E (F2 vazio OU casa ≥1 matéria).
 * Se F1 tem status, NÃO aceita texto ambíguo sem sinal claro.
 */

export type FiltroStatusId =
  | "extinto_sem_merito"
  | "extinto_com_merito"
  | "ativo"
  | "encerrado";

export type FiltroMateriaId =
  | "procedimento_comum_civel"
  | "acao_revisional"
  | "alienacao_fiduciaria"
  | "contratos_bancarios"
  | "busca_apreensao"
  | "cumprimento_sentenca"
  | "improcedente"
  | "procedente_parcial";

/** legado + novos */
export type FiltroRevisionalId = FiltroStatusId | FiltroMateriaId;

export type TipoFiltro = "status" | "classe" | "assunto" | "resultado" | "fase";

export interface FiltroRevisional {
  id: FiltroRevisionalId;
  grupo: "status" | "materia";
  tipo: TipoFiltro;
  nomeTribunal: string;
  /** termo enviado ao DJEN */
  djenQuery: string;
  aliases: string[];
  defaultOn: boolean;
}

export const FILTROS_STATUS: FiltroRevisional[] = [
  {
    id: "extinto_sem_merito",
    grupo: "status",
    tipo: "status",
    nomeTribunal: "Extinto sem resolução do mérito",
    djenQuery: "extinção sem resolução do mérito",
    aliases: [
      "sem resolução do mérito",
      "sem resolucao do merito",
      "extinto sem resolução",
      "extinção sem resolução",
      "art. 485",
      "artigo 485",
      "art 485",
    ],
    defaultOn: true,
  },
  {
    id: "extinto_com_merito",
    grupo: "status",
    tipo: "status",
    nomeTribunal: "Extinto com resolução do mérito",
    djenQuery: "extinção com resolução do mérito",
    aliases: [
      "com resolução do mérito",
      "com resolucao do merito",
      "extinto com resolução",
      "art. 487",
      "artigo 487",
      "art 487",
    ],
    defaultOn: false,
  },
  {
    id: "ativo",
    grupo: "status",
    tipo: "status",
    nomeTribunal: "Ativo / em andamento",
    djenQuery: "intime-se",
    aliases: ["em andamento", "prosiga-se", "especifiquem as provas", "réplica"],
    defaultOn: false,
  },
  {
    id: "encerrado",
    grupo: "status",
    tipo: "status",
    nomeTribunal: "Encerrado / arquivado / baixado",
    djenQuery: "arquivamento",
    aliases: [
      "arquivado",
      "arquivamento",
      "baixa definitiva",
      "baixado",
      "trânsito em julgado",
      "transito em julgado",
      "encerrado",
      "extinção do processo",
    ],
    defaultOn: false,
  },
];

export const FILTROS_MATERIA: FiltroRevisional[] = [
  {
    id: "procedimento_comum_civel",
    grupo: "materia",
    tipo: "classe",
    nomeTribunal: "PROCEDIMENTO COMUM CÍVEL",
    djenQuery: "PROCEDIMENTO COMUM CÍVEL",
    aliases: ["procedimento comum cível", "procedimento comum civel", "procedimento comum"],
    defaultOn: true,
  },
  {
    id: "acao_revisional",
    grupo: "materia",
    tipo: "assunto",
    nomeTribunal: "Ação revisional de contrato",
    djenQuery: "revisional",
    aliases: ["ação revisional", "revisional de contrato", "repetição de indébito", "repeticao de indebito"],
    defaultOn: true,
  },
  {
    id: "alienacao_fiduciaria",
    grupo: "materia",
    tipo: "assunto",
    nomeTribunal: "Alienação fiduciária",
    djenQuery: "alienação fiduciária",
    aliases: ["alienação fiduciária", "alienacao fiduciaria"],
    defaultOn: false,
  },
  {
    id: "contratos_bancarios",
    grupo: "materia",
    tipo: "assunto",
    nomeTribunal: "Contratos bancários",
    djenQuery: "contratos bancários",
    aliases: ["contratos bancários", "contratos bancarios"],
    defaultOn: false,
  },
  {
    id: "busca_apreensao",
    grupo: "materia",
    tipo: "classe",
    nomeTribunal: "Busca e apreensão",
    djenQuery: "busca e apreensão",
    aliases: ["busca e apreensão", "busca e apreensao"],
    defaultOn: false,
  },
  {
    id: "cumprimento_sentenca",
    grupo: "materia",
    tipo: "fase",
    nomeTribunal: "Cumprimento de sentença",
    djenQuery: "cumprimento de sentença",
    aliases: ["cumprimento de sentença", "cumprimento de sentenca"],
    defaultOn: false,
  },
  {
    id: "improcedente",
    grupo: "materia",
    tipo: "resultado",
    nomeTribunal: "Improcedente",
    djenQuery: "julgo improcedente",
    aliases: ["improcedente", "julgo improcedente"],
    defaultOn: false,
  },
  {
    id: "procedente_parcial",
    grupo: "materia",
    tipo: "resultado",
    nomeTribunal: "Procedente em parte",
    djenQuery: "parcialmente procedente",
    aliases: ["procedente em parte", "parcialmente procedente"],
    defaultOn: false,
  },
];

export const FILTROS_REVISIONAL: FiltroRevisional[] = [...FILTROS_STATUS, ...FILTROS_MATERIA];

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

const RE_SEM_MERITO =
  /sem\s+resolu[cç][aã]o\s+do\s+m[eé]rito|extin[cç][aã]o\s+sem\s+resolu|art\.?\s*485\b|artigo\s*485\b/i;
const RE_COM_MERITO =
  /com\s+resolu[cç][aã]o\s+do\s+m[eé]rito|extin[cç][aã]o\s+com\s+resolu|art\.?\s*487\b|artigo\s*487\b/i;
const RE_ENCERRADO =
  /\barquiv|\bbaixad|baixa\s+definitiva|tr[aâ]nsito\s+em\s+julgado|processo\s+encerrad|extin[cç][aã]o\s+do\s+processo/i;
const RE_EXTINTO_GERAL = /extin[cç][aã]o|extinto/i;

export function detectStatus(texto: string): FiltroStatusId | null {
  const t = String(texto || "");
  if (RE_SEM_MERITO.test(t)) return "extinto_sem_merito";
  if (RE_COM_MERITO.test(t)) return "extinto_com_merito";
  if (RE_ENCERRADO.test(t)) return "encerrado";
  // ativo: não tem sinal de extinção/arquivamento forte
  if (RE_EXTINTO_GERAL.test(t) && !RE_SEM_MERITO.test(t) && !RE_COM_MERITO.test(t)) {
    // extinção genérica sem classificar → trata como encerrado
    return "encerrado";
  }
  return "ativo";
}

export function matchMateria(texto: string, ativos: FiltroMateriaId[]): FiltroMateriaId[] {
  const n = normMatch(texto);
  const hits: FiltroMateriaId[] = [];
  for (const f of FILTROS_MATERIA) {
    if (!ativos.includes(f.id as FiltroMateriaId)) continue;
    const names = [f.nomeTribunal, f.djenQuery, ...f.aliases].map(normMatch);
    if (names.some((a) => a && n.includes(a))) hits.push(f.id as FiltroMateriaId);
  }
  return hits;
}

/**
 * Decisão final de aceite.
 * - Status selecionados → OBRIGA detectStatus ∈ selecionados
 * - Matéria selecionada → OBRIGA ≥1 hit de matéria
 */
export function passaFiltrosCombinados(
  texto: string,
  statusAtivos: FiltroStatusId[],
  materiaAtivos: FiltroMateriaId[]
): { ok: boolean; status: FiltroStatusId | null; materiaHits: FiltroMateriaId[]; motivo?: string } {
  const status = detectStatus(texto);
  const materiaHits = materiaAtivos.length ? matchMateria(texto, materiaAtivos) : [];

  if (statusAtivos.length) {
    if (!status || !statusAtivos.includes(status)) {
      return { ok: false, status, materiaHits, motivo: `status=${status || "?"}≠filtro` };
    }
  }
  if (materiaAtivos.length) {
    if (!materiaHits.length) {
      return { ok: false, status, materiaHits, motivo: "sem matéria" };
    }
  }
  // se nenhum filtro de nenhum grupo — rejeita (UI deve exigir)
  if (!statusAtivos.length && !materiaAtivos.length) {
    return { ok: false, status, materiaHits, motivo: "sem filtros" };
  }
  return { ok: true, status, materiaHits };
}

/** Queries DJEN: combina status × matéria (produto cartesiano limitado) */
export function buildDjenQueries(
  statusAtivos: FiltroStatusId[],
  materiaAtivos: FiltroMateriaId[],
  cnpjDigits?: string
): string[] {
  const st = FILTROS_STATUS.filter((f) => statusAtivos.includes(f.id as FiltroStatusId));
  const mt = FILTROS_MATERIA.filter((f) => materiaAtivos.includes(f.id as FiltroMateriaId));
  const cnpj = (cnpjDigits || "").replace(/\D/g, "");
  const cnpjPart = cnpj.length >= 8 ? cnpj : "";

  const queries: string[] = [];
  const push = (q: string) => {
    const s = [q, cnpjPart].filter(Boolean).join(" ").trim();
    if (s && !queries.includes(s)) queries.push(s);
  };

  if (st.length && mt.length) {
    for (const s of st) {
      for (const m of mt) {
        push(`${s.djenQuery} ${m.djenQuery}`);
      }
    }
  } else if (st.length) {
    for (const s of st) push(s.djenQuery);
  } else if (mt.length) {
    for (const m of mt) push(m.djenQuery);
  }

  if (!queries.length && cnpjPart) push(cnpjPart);
  return queries.slice(0, 12); // limite de combinações
}

export function onlyDigitsDoc(s: string): string {
  return String(s || "").replace(/\D/g, "");
}

export function formatCnpj(digits: string): string {
  const d = onlyDigitsDoc(digits).slice(0, 14);
  if (d.length !== 14) return d;
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
}

export function textoTemCnpj(texto: string, cnpjDigits: string): boolean {
  const want = onlyDigitsDoc(cnpjDigits);
  if (want.length < 8) return true; // sem filtro
  const all = onlyDigitsDoc(texto);
  return all.includes(want);
}

// —— reexports higiene / nome (usados na action) ——
export {
  cnjDvValido,
  extractCnjSeguro,
  extractTelefoneSeguro,
  formatCnjMasked,
} from "@/lib/cnj-higiene";

import { extractCnjSeguro as _ext } from "@/lib/cnj-higiene";

const SIGILO_RE =
  /segredo\s+de\s+justi[cç]a|segredo\s+justi[cç]a|processo\s+em\s+sigilo|autos?\s+em\s+sigilo|sigilo\s+de\s+justi[cç]a|conte[uú]do\s+sigiloso|sob\s+segredo/i;

export function isSegredoOuSigilo(blob: string): boolean {
  return SIGILO_RE.test(String(blob || ""));
}

export function teorConsultavel(texto: string | null | undefined): boolean {
  const t = String(texto || "").replace(/\s+/g, " ").trim();
  return t.length >= 40 && !isSegredoOuSigilo(t);
}

export function extractNomeCompletoFromDjen(item: {
  texto?: string | null;
  destinatarios?: Array<{ nome?: string; polo?: string }> | null;
}): string {
  const dest = item.destinatarios || [];
  const ativo = dest.find((d) => /ativ|autor|requerente|exequente|reclamante|agravante/i.test(String(d.polo || "")));
  if (ativo?.nome && !isBanco(ativo.nome)) return cleanNome(ativo.nome);
  const text = String(item.texto || "");
  const m = text.match(
    /(?:AUTOR|REQUERENTE|EXEQUENTE|RECLAMANTE|AGRAVANTE)\s*[:\-–]\s*([A-ZÁÉÍÓÚÂÊÔÃÕÇ][A-ZÁÉÍÓÚÂÊÔÃÕÇa-záéíóúâêôãõç'\s\.]{5,90}?)(?:\s{2,}|\s+ADVOGADO|\s+R[EÉ]U|\s+REQUERID|\s+AGRAVAD|\n|$)/i
  );
  if (m?.[1] && !isBanco(m[1]) && !/estado\s+de/i.test(m[1])) return cleanNome(m[1]);
  const anyPf = dest.find((d) => d.nome && !isBanco(d.nome) && String(d.nome).trim().length >= 8);
  if (anyPf?.nome) return cleanNome(anyPf.nome);
  return "";
}

function isBanco(s: string) {
  return /banco|s\/a|ltda|finan|credito|crédito|estado\s+de|fazenda|munic[ií]pio|sesi|inss|condom[ií]nio/i.test(String(s || ""));
}
function cleanNome(raw: string): string {
  let s = String(raw || "").replace(/\s+/g, " ").trim();
  s = s.split(/\s+(?:ADVOGADO|OAB|R[EÉ]U|REQUERID|INTIMAD|FICA\s|AGRAVAD)/i)[0].trim();
  return s.slice(0, 90).trim();
}

export interface ProcessoDjenReal {
  processo: string;
  nome_completo: string;
  telefone: string;
  email: string;
  cpf: string;
  cnpj: string;
  endereco: string;
  cep: string;
  bairro: string;
  municipio: string;
  uf: string;
  situacao_cadastral: string;
  telefone_fonte: string;
  enrich_fonte: string;
  classe: string;
  assunto_ou_teor: string;
  situacao_hint: string;
  status_detectado: string;
  tribunal: string;
  data: string;
  link: string;
  filtros: string;
  consultavel: boolean;
}

export interface ScanLogLine {
  ts: string;
  level: "info" | "ok" | "skip" | "warn" | "err";
  text: string;
}

/** compat: filtrosDefaultOn antigo misturava tudo */
export function filtrosDefaultStatus(): FiltroStatusId[] {
  return FILTROS_STATUS.filter((f) => f.defaultOn).map((f) => f.id as FiltroStatusId);
}
export function filtrosDefaultMateria(): FiltroMateriaId[] {
  return FILTROS_MATERIA.filter((f) => f.defaultOn).map((f) => f.id as FiltroMateriaId);
}

import {
  cnjDvValido,
  extractCnjSeguro,
  extractTelefoneSeguro,
  formatCnjMasked,
} from "@/lib/cnj-higiene";

export type FiltroStatusId = "extinto_sem_merito" | "extinto_com_merito" | "ativo" | "encerrado";
export type FiltroMateriaId =
  | "procedimento_comum_civel"
  | "acao_revisional"
  | "alienacao_fiduciaria"
  | "contratos_bancarios"
  | "busca_apreensao"
  | "cumprimento_sentenca"
  | "improcedente"
  | "procedente_parcial";
export type FiltroRevisionalId = FiltroStatusId | FiltroMateriaId;

export interface FiltroRevisional {
  id: FiltroRevisionalId;
  grupo: "status" | "materia";
  nomeTribunal: string;
  djenQuery: string;
  aliases: string[];
  defaultOn: boolean;
}

export const FILTROS_STATUS: FiltroRevisional[] = [
  { id: "extinto_sem_merito", grupo: "status", nomeTribunal: "Extinto sem resolução do mérito", djenQuery: "art. 485", aliases: ["sem resolução do mérito", "art. 485", "artigo 485"], defaultOn: true },
  { id: "extinto_com_merito", grupo: "status", nomeTribunal: "Extinto com resolução do mérito", djenQuery: "art. 487", aliases: ["com resolução do mérito", "art. 487"], defaultOn: false },
  { id: "ativo", grupo: "status", nomeTribunal: "Ativo / em andamento", djenQuery: "intime-se", aliases: ["em andamento", "prosiga-se"], defaultOn: false },
  { id: "encerrado", grupo: "status", nomeTribunal: "Encerrado / arquivado", djenQuery: "arquivamento", aliases: ["arquivado", "baixado", "trânsito em julgado"], defaultOn: false },
];

export const FILTROS_MATERIA: FiltroRevisional[] = [
  { id: "procedimento_comum_civel", grupo: "materia", nomeTribunal: "PROCEDIMENTO COMUM CÍVEL", djenQuery: "PROCEDIMENTO COMUM CÍVEL", aliases: ["procedimento comum"], defaultOn: true },
  { id: "acao_revisional", grupo: "materia", nomeTribunal: "Ação revisional", djenQuery: "revisional", aliases: ["ação revisional", "repetição de indébito"], defaultOn: true },
  { id: "alienacao_fiduciaria", grupo: "materia", nomeTribunal: "Alienação fiduciária", djenQuery: "alienação fiduciária", aliases: ["alienacao fiduciaria"], defaultOn: false },
  { id: "contratos_bancarios", grupo: "materia", nomeTribunal: "Contratos bancários", djenQuery: "contratos bancários", aliases: ["contratos bancarios"], defaultOn: false },
  { id: "busca_apreensao", grupo: "materia", nomeTribunal: "Busca e apreensão", djenQuery: "busca e apreensão", aliases: ["busca e apreensao"], defaultOn: false },
  { id: "cumprimento_sentenca", grupo: "materia", nomeTribunal: "Cumprimento de sentença", djenQuery: "cumprimento de sentença", aliases: ["cumprimento de sentenca"], defaultOn: false },
  { id: "improcedente", grupo: "materia", nomeTribunal: "Improcedente", djenQuery: "julgo improcedente", aliases: ["improcedente"], defaultOn: false },
  { id: "procedente_parcial", grupo: "materia", nomeTribunal: "Procedente em parte", djenQuery: "parcialmente procedente", aliases: ["procedente em parte"], defaultOn: false },
];

export const FILTROS_REVISIONAL = [...FILTROS_STATUS, ...FILTROS_MATERIA];

export function filtrosDefaultOn(): FiltroRevisionalId[] {
  return FILTROS_REVISIONAL.filter((f) => f.defaultOn).map((f) => f.id);
}
export function filtrosDefaultStatus(): FiltroStatusId[] {
  return FILTROS_STATUS.filter((f) => f.defaultOn).map((f) => f.id as FiltroStatusId);
}
export function filtrosDefaultMateria(): FiltroMateriaId[] {
  return FILTROS_MATERIA.filter((f) => f.defaultOn).map((f) => f.id as FiltroMateriaId);
}

export function normMatch(s: string): string {
  return String(s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim();
}

const RE_SEM = /sem\s+resolu[cç][aã]o\s+do\s+m[eé]rito|art\.?\s*485\b|artigo\s*485/i;
const RE_COM = /com\s+resolu[cç][aã]o\s+do\s+m[eé]rito|art\.?\s*487\b/i;
const RE_ENC = /\barquiv|\bbaixad|tr[aâ]nsito\s+em\s+julgado|processo\s+encerrad/i;

export function detectStatus(texto: string): FiltroStatusId | null {
  const t = String(texto || "");
  if (RE_SEM.test(t)) return "extinto_sem_merito";
  if (RE_COM.test(t)) return "extinto_com_merito";
  if (RE_ENC.test(t)) return "encerrado";
  if (/extin[cç][aã]o|extinto/i.test(t)) return "encerrado";
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

export function passaFiltrosCombinados(
  texto: string,
  statusAtivos: FiltroStatusId[],
  materiaAtivos: FiltroMateriaId[]
) {
  const status = detectStatus(texto);
  const materiaHits = materiaAtivos.length ? matchMateria(texto, materiaAtivos) : [];
  if (statusAtivos.length && (!status || !statusAtivos.includes(status))) {
    return { ok: false as const, status, materiaHits, motivo: "status" };
  }
  if (materiaAtivos.length && !materiaHits.length) {
    return { ok: false as const, status, materiaHits, motivo: "materia" };
  }
  if (!statusAtivos.length && !materiaAtivos.length) {
    return { ok: false as const, status, materiaHits, motivo: "vazio" };
  }
  return { ok: true as const, status, materiaHits };
}

export function textoTemCnpj(texto: string, cnpjDigits: string): boolean {
  const want = String(cnpjDigits || "").replace(/\D/g, "");
  if (want.length < 8) return true;
  return String(texto || "").replace(/\D/g, "").includes(want);
}

export { cnjDvValido, extractCnjSeguro, extractTelefoneSeguro, formatCnjMasked };

const SIGILO = /segredo\s+de\s+justi[cç]a|processo\s+em\s+sigilo|autos?\s+em\s+sigilo|sob\s+segredo/i;
export function isSegredoOuSigilo(b: string) {
  return SIGILO.test(String(b || ""));
}
export function teorConsultavel(t?: string | null) {
  const s = String(t || "").replace(/\s+/g, " ").trim();
  return s.length >= 40 && !isSegredoOuSigilo(s);
}

export function extractNomeCompletoFromDjen(item: {
  texto?: string | null;
  destinatarios?: Array<{ nome?: string; polo?: string }> | null;
}): string {
  const dest = item.destinatarios || [];
  const ativo = dest.find((d) => /ativ|autor|requerente|exequente/i.test(String(d.polo || "")));
  if (ativo?.nome && !/banco|s\/a|ltda|estado/i.test(ativo.nome)) return clean(ativo.nome);
  const m = String(item.texto || "").match(
    /(?:AUTOR|REQUERENTE|EXEQUENTE)\s*[:\-–]\s*([A-ZÁÉÍÓÚÂÊÔÃÕÇ][A-ZÁÉÍÓÚÂÊÔÃÕÇa-záéíóúâêôãõç'\s\.]{5,90}?)(?:\s{2,}|\s+ADVOGADO|\s+R[EÉ]U|\n|$)/i
  );
  if (m?.[1] && !/banco|estado/i.test(m[1])) return clean(m[1]);
  const any = dest.find((d) => d.nome && String(d.nome).length >= 8 && !/banco|s\/a/i.test(d.nome));
  return any?.nome ? clean(any.nome) : "";
}
function clean(raw: string) {
  return String(raw)
    .replace(/\s+/g, " ")
    .split(/\s+(?:ADVOGADO|OAB|R[EÉ]U)/i)[0]
    .trim()
    .slice(0, 90);
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

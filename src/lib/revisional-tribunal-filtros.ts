import {
  cnjDvValido,
  cnjEstruturaPlausivel,
  extractCnjSeguro,
  extractTelefoneSeguro,
  formatCnjMasked,
} from "@/lib/cnj-higiene";

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

export interface FiltroRevisional {
  id: FiltroRevisionalId;
  tipo: "classe" | "assunto" | "resultado" | "fase";
  nomeTribunal: string;
  djenQuery: string;
  aliases: string[];
  defaultOn: boolean;
}

export const FILTROS_REVISIONAL: FiltroRevisional[] = [
  { id: "procedimento_comum_civel", tipo: "classe", nomeTribunal: "PROCEDIMENTO COMUM CÍVEL", djenQuery: "PROCEDIMENTO COMUM CÍVEL", aliases: ["procedimento comum cível", "procedimento comum civel"], defaultOn: true },
  { id: "acao_revisional", tipo: "assunto", nomeTribunal: "Ação revisional de contrato", djenQuery: "revisional", aliases: ["ação revisional", "revisional de contrato", "repetição de indébito"], defaultOn: true },
  { id: "alienacao_fiduciaria", tipo: "assunto", nomeTribunal: "Alienação fiduciária", djenQuery: "alienação fiduciária", aliases: ["alienação fiduciária"], defaultOn: true },
  { id: "contratos_bancarios", tipo: "assunto", nomeTribunal: "Contratos bancários", djenQuery: "contratos bancários", aliases: ["contratos bancários"], defaultOn: false },
  { id: "busca_apreensao", tipo: "classe", nomeTribunal: "Busca e apreensão", djenQuery: "busca e apreensão", aliases: ["busca e apreensão"], defaultOn: false },
  { id: "cumprimento_sentenca", tipo: "fase", nomeTribunal: "Cumprimento de sentença", djenQuery: "cumprimento de sentença", aliases: ["cumprimento de sentença"], defaultOn: false },
  { id: "extinto_sem_merito", tipo: "resultado", nomeTribunal: "Extinto sem resolução do mérito", djenQuery: "sem resolução do mérito", aliases: ["sem resolução do mérito", "art. 485"], defaultOn: false },
  { id: "extinto_com_merito", tipo: "resultado", nomeTribunal: "Extinto com resolução do mérito", djenQuery: "com resolução do mérito", aliases: ["com resolução do mérito", "art. 487"], defaultOn: false },
  { id: "improcedente", tipo: "resultado", nomeTribunal: "Improcedente", djenQuery: "julgo improcedente", aliases: ["improcedente"], defaultOn: false },
  { id: "procedente_parcial", tipo: "resultado", nomeTribunal: "Procedente em parte", djenQuery: "parcialmente procedente", aliases: ["procedente em parte"], defaultOn: false },
];

export function filtrosDefaultOn(): FiltroRevisionalId[] {
  return FILTROS_REVISIONAL.filter((f) => f.defaultOn).map((f) => f.id);
}

export function normMatch(s: string): string {
  return String(s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim();
}

export function matchFiltrosRevisional(texto: string, ativos: FiltroRevisionalId[]) {
  const n = normMatch(texto);
  const hits: FiltroRevisionalId[] = [];
  if (!n) return { ok: false, hits };
  for (const f of FILTROS_REVISIONAL) {
    if (!ativos.includes(f.id)) continue;
    const names = [f.nomeTribunal, f.djenQuery, ...f.aliases].map(normMatch);
    if (names.some((a) => a && n.includes(a))) hits.push(f.id);
  }
  return { ok: hits.length > 0, hits };
}

export { cnjDvValido, formatCnjMasked, extractCnjSeguro, extractTelefoneSeguro, cnjEstruturaPlausivel };

/** @deprecated use extractCnjSeguro */
export function extractCnjRobusto(api: string | null | undefined, texto: string | null | undefined, sigla?: string) {
  return extractCnjSeguro(api, texto, { siglaTribunal: sigla });
}

export function extractTelefoneFromText(texto: string | null | undefined): string {
  return extractTelefoneSeguro(texto);
}

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

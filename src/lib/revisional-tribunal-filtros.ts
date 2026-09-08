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
  { id: "alienacao_fiduciaria", tipo: "assunto", nomeTribunal: "Alienação fiduciária", djenQuery: "alienação fiduciária", aliases: ["alienação fiduciária", "alienacao fiduciaria"], defaultOn: true },
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

export function cnjDvValido(digits20: string): boolean {
  const d = String(digits20 || "").replace(/\D/g, "");
  if (d.length !== 20 || /^0+$/.test(d)) return false;
  try {
    const calc = String(98n - (BigInt(d.slice(0, 7) + d.slice(9)) % 97n)).padStart(2, "0");
    return calc === d.slice(7, 9);
  } catch {
    return false;
  }
}

export function formatCnjMasked(digits: string): string {
  const x = String(digits || "").replace(/\D/g, "").slice(0, 20);
  if (x.length !== 20) return x;
  return `${x.slice(0, 7)}-${x.slice(7, 9)}.${x.slice(9, 13)}.${x.slice(13, 14)}.${x.slice(14, 16)}.${x.slice(16, 20)}`;
}

export function extractCnjRobusto(apiField: string | null | undefined, texto: string | null | undefined): string | null {
  const tryDigits = (raw: string): string | null => {
    const d = String(raw || "").replace(/\D/g, "");
    if (d.length === 20 && cnjDvValido(d)) return d;
    if (d.length > 20) {
      for (let i = 0; i <= d.length - 20; i++) {
        const slice = d.slice(i, i + 20);
        if (cnjDvValido(slice)) return slice;
      }
    }
    return null;
  };
  const fromApi = tryDigits(String(apiField || ""));
  if (fromApi) return fromApi;
  const text = String(texto || "");
  const patterns = [
    /N[º°o]\s*(\d{7})[.\-]?(\d{2})[.\-]?(\d{4})[.\-]?(\d)[.\-]?(\d{2})[.\-]?(\d{4})/gi,
    /Processo\s*(?:n[º°o])?\s*:?\s*(\d{7})[.\-]?(\d{2})[.\-]?(\d{4})[.\-]?(\d)[.\-]?(\d{2})[.\-]?(\d{4})/gi,
    /\b(\d{7})-(\d{2})\.(\d{4})\.(\d)\.(\d{2})\.(\d{4})\b/g,
  ];
  for (const re of patterns) {
    let m: RegExpExecArray | null;
    while ((m = re.exec(text))) {
      if (m[1] && m[6]) {
        const d = `${m[1]}${m[2]}${m[3]}${m[4]}${m[5]}${m[6]}`;
        if (cnjDvValido(d)) return d;
      }
    }
  }
  return tryDigits(text);
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
  return /banco|s\/a|ltda|finan|credito|crédito|estado\s+de|fazenda|munic[ií]pio/i.test(String(s || ""));
}
function cleanNome(raw: string): string {
  let s = String(raw || "").replace(/\s+/g, " ").trim();
  s = s.split(/\s+(?:ADVOGADO|OAB|R[EÉ]U|REQUERID|INTIMAD|FICA\s|AGRAVAD)/i)[0].trim();
  return s.slice(0, 90).trim();
}

export function extractTelefoneFromText(texto: string | null | undefined): string {
  const t = String(texto || "");
  const re = /(?:\+?55\s*)?(?:\(?\d{2}\)?\s*)?(?:9\s?\d{4}|\d{4})[-\s]?\d{4}\b/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(t))) {
    let d = m[0].replace(/\D/g, "");
    if (d.startsWith("55") && d.length >= 12) d = d.slice(2);
    if (d.length !== 10 && d.length !== 11) continue;
    if (/^(\d)\1+$/.test(d)) continue;
    const ddd = Number(d.slice(0, 2));
    if (ddd < 11 || ddd > 99) continue;
    return d.length === 11
      ? `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
      : `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  }
  return "";
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

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
  { id: "procedimento_comum_civel", tipo: "classe", nomeTribunal: "PROCEDIMENTO COMUM CÍVEL", djenQuery: "PROCEDIMENTO COMUM CÍVEL", aliases: ["procedimento comum cível", "procedimento comum civel", "procedimento comum"], defaultOn: true },
  { id: "acao_revisional", tipo: "assunto", nomeTribunal: "Ação revisional de contrato", djenQuery: "ação revisional de contrato", aliases: ["ação revisional", "acao revisional", "revisional de contrato", "revisão de cláusulas"], defaultOn: true },
  { id: "alienacao_fiduciaria", tipo: "assunto", nomeTribunal: "Alienação fiduciária", djenQuery: "alienação fiduciária", aliases: ["alienação fiduciária", "alienacao fiduciaria"], defaultOn: true },
  { id: "contratos_bancarios", tipo: "assunto", nomeTribunal: "Contratos bancários", djenQuery: "contratos bancários", aliases: ["contratos bancários", "contratos bancarios"], defaultOn: false },
  { id: "busca_apreensao", tipo: "classe", nomeTribunal: "Busca e apreensão", djenQuery: "busca e apreensão", aliases: ["busca e apreensão", "busca e apreensao"], defaultOn: false },
  { id: "cumprimento_sentenca", tipo: "fase", nomeTribunal: "Cumprimento de sentença", djenQuery: "cumprimento de sentença", aliases: ["cumprimento de sentença"], defaultOn: false },
  { id: "extinto_sem_merito", tipo: "resultado", nomeTribunal: "Extinto sem resolução do mérito", djenQuery: "sem resolução do mérito", aliases: ["sem resolução do mérito", "art. 485", "artigo 485", "extinção sem resolução"], defaultOn: false },
  { id: "extinto_com_merito", tipo: "resultado", nomeTribunal: "Extinto com resolução do mérito", djenQuery: "com resolução do mérito", aliases: ["com resolução do mérito", "art. 487"], defaultOn: false },
  { id: "improcedente", tipo: "resultado", nomeTribunal: "Improcedente", djenQuery: "julgo improcedente", aliases: ["improcedente"], defaultOn: false },
  { id: "procedente_parcial", tipo: "resultado", nomeTribunal: "Procedente em parte", djenQuery: "parcialmente procedente", aliases: ["procedente em parte", "parcialmente procedente"], defaultOn: false },
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
    const seq = d.slice(0, 7);
    const dv = d.slice(7, 9);
    const rest = d.slice(9);
    if (rest.length !== 11) return false;
    const calc = String(98n - (BigInt(seq + rest) % 97n)).padStart(2, "0");
    return calc === dv;
  } catch {
    return false;
  }
}

export function extractCnjFromApiField(raw: string | null | undefined): string | null {
  const d = String(raw || "").replace(/\D/g, "");
  return d.length === 20 && cnjDvValido(d) ? d : null;
}

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

/** Bloqueio duro de sigilo / segredo de justiça */
const SIGILO_RE =
  /segredo\s+de\s+justi[cç]a|segredo\s+justi[cç]a|em\s+segredo\s+de\s+justi[cç]a|processo\s+em\s+sigilo|autos?\s+em\s+sigilo|sigilo\s+de\s+justi[cç]a|justi[cç]a\s+sigilosa|conte[uú]do\s+sigiloso|indispon[ií]vel\s+por\s+sigilo|protegido\s+por\s+sigilo|tramita(?:ção)?\s+em\s+segredo|sob\s+segredo|sigiloso/i;

export function isSegredoOuSigilo(blob: string): boolean {
  return SIGILO_RE.test(String(blob || ""));
}

export function teorConsultavel(texto: string | null | undefined): boolean {
  const t = String(texto || "").replace(/\s+/g, " ").trim();
  if (t.length < 50) return false;
  if (isSegredoOuSigilo(t)) return false;
  return true;
}

export function extractNomeCompletoFromDjen(item: {
  texto?: string | null;
  destinatarios?: Array<{ nome?: string; polo?: string }> | null;
}): string {
  const dest = item.destinatarios || [];
  const ativo = dest.find((d) => /ativ|autor|requerente|exequente/i.test(String(d.polo || "")));
  if (ativo?.nome && String(ativo.nome).trim().length >= 6 && !/banco|s\/a|ltda/i.test(ativo.nome)) {
    return cleanNome(String(ativo.nome));
  }
  const anyPf = dest.find(
    (d) => d.nome && String(d.nome).trim().length >= 8 && !/banco|s\/a|ltda|finan|credito|crédito/i.test(String(d.nome))
  );
  if (anyPf?.nome) return cleanNome(String(anyPf.nome));
  const text = String(item.texto || "");
  const m = text.match(
    /(?:AUTOR|REQUERENTE|EXEQUENTE|RECLAMANTE)\s*[:\-–]\s*([A-ZÁÉÍÓÚÂÊÔÃÕÇ][A-ZÁÉÍÓÚÂÊÔÃÕÇa-záéíóúâêôãõç'\s\.]{6,90}?)(?:\s{2,}|\s+ADVOGADO|\s+R[EÉ]U|\s+REQUERID|\n|$)/i
  );
  if (m?.[1] && !/banco|s\/a/i.test(m[1])) return cleanNome(m[1]);
  return "";
}

function cleanNome(raw: string): string {
  let s = String(raw || "").replace(/\s+/g, " ").trim();
  s = s.split(/\s+(?:ADVOGADO|OAB|R[EÉ]U|REQUERID|INTIMAD|FICA\s)/i)[0].trim();
  return s.slice(0, 90).trim();
}

/** Telefone só se aparecer no teor público (nunca inventado) */
export function extractTelefoneFromText(texto: string | null | undefined): string {
  const t = String(texto || "");
  // (11) 98888-7777 | 11988887777 | +55 11 98888-7777
  const patterns = [
    /(?:\+?55\s*)?(?:\(?\d{2}\)?\s*)?(?:9\s?\d{4}|\d{4})[-\s]?\d{4}\b/g,
  ];
  const found: string[] = [];
  for (const re of patterns) {
    let m: RegExpExecArray | null;
    while ((m = re.exec(t))) {
      const digits = m[0].replace(/\D/g, "");
      // celular BR: 10 ou 11 dígitos (DDD+numero), ou 12/13 com 55
      let d = digits;
      if (d.startsWith("55") && d.length >= 12) d = d.slice(2);
      if (d.length === 10 || d.length === 11) {
        // evita CNJ / protocolo colado
        if (/^(\d)\1+$/.test(d)) continue;
        const ddd = d.slice(0, 2);
        if (Number(ddd) < 11 || Number(ddd) > 99) continue;
        const fmt =
          d.length === 11
            ? `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
            : `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
        if (!found.includes(fmt)) found.push(fmt);
      }
    }
  }
  return found[0] || "";
}

export interface ProcessoDjenReal {
  processo: string;
  nome_completo: string;
  telefone: string;
  telefone_fonte: string;
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

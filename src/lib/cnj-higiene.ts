/**
 * Higiene CNJ — só aceita número com máscara oficial + estrutura plausível.
 * Nunca monta CNJ a partir de "janela" de dígitos soltos no texto (gera fictício).
 */

export function cnjDvValido(digits20: string): boolean {
  const d = String(digits20 || "").replace(/\D/g, "");
  if (d.length !== 20 || /^0+$/.test(d)) return false;
  try {
    const seq = d.slice(0, 7);
    const dv = d.slice(7, 9);
    const rest = d.slice(9); // AAAA J TR OOOO
    if (rest.length !== 11) return false;
    const calc = String(98n - (BigInt(seq + rest) % 97n)).padStart(2, "0");
    return calc === dv;
  } catch {
    return false;
  }
}

export function formatCnjMasked(digits: string): string {
  const x = String(digits || "").replace(/\D/g, "").slice(0, 20);
  if (x.length !== 20) return x;
  return `${x.slice(0, 7)}-${x.slice(7, 9)}.${x.slice(9, 13)}.${x.slice(13, 14)}.${x.slice(14, 16)}.${x.slice(16, 20)}`;
}

/** Partes do CNJ 20 dígitos */
export function parseCnjParts(digits20: string): {
  seq: string;
  dv: string;
  ano: number;
  justica: string;
  tr: string;
  origem: string;
} | null {
  const d = String(digits20 || "").replace(/\D/g, "");
  if (d.length !== 20) return null;
  return {
    seq: d.slice(0, 7),
    dv: d.slice(7, 9),
    ano: parseInt(d.slice(9, 13), 10),
    justica: d.slice(13, 14),
    tr: d.slice(14, 16),
    origem: d.slice(16, 20),
  };
}

const ANO_MIN = 1998;
const ANO_MAX = new Date().getFullYear() + 1;

/** Justiça estadual = 8; TR de tribunais estaduais comuns */
const TR_ESTADUAL = new Set([
  "01","02","03","04","05","06","07","08","09","10",
  "11","12","13","14","15","16","17","18","19","20",
  "21","22","23","24","25","26","27",
]);

/**
 * Estrutura mínima de um processo real de 1º grau estadual.
 * Rejeita anos absurdo (1860, 3742), justiça 0, TR inválido.
 */
export function cnjEstruturaPlausivel(
  digits20: string,
  opts?: { siglaTribunal?: string | null }
): { ok: boolean; motivo?: string } {
  if (!cnjDvValido(digits20)) return { ok: false, motivo: "dv" };
  const p = parseCnjParts(digits20);
  if (!p) return { ok: false, motivo: "tamanho" };
  if (p.ano < ANO_MIN || p.ano > ANO_MAX) return { ok: false, motivo: `ano_${p.ano}` };
  // Justiça: 1 STF … 8 estadual … 9 estadual militar etc. — rejeita 0
  if (!/^[1-9]$/.test(p.justica)) return { ok: false, motivo: "justica" };
  if (p.justica === "8" && !TR_ESTADUAL.has(p.tr)) return { ok: false, motivo: "tr" };

  const sigla = String(opts?.siglaTribunal || "").toUpperCase().replace(/\s/g, "");
  if (sigla === "TJSP" || sigla === "SP") {
    // TJSP: justiça 8, tribunal 26
    if (p.justica !== "8" || p.tr !== "26") return { ok: false, motivo: "nao_tjsp" };
  } else if (sigla.startsWith("TJ") && sigla.length >= 4) {
    // outros TJs: ainda exige justiça estadual 8 e TR estadual
    if (p.justica !== "8") return { ok: false, motivo: "nao_estadual" };
  }
  return { ok: true };
}

/**
 * Só extrai CNJ se aparecer com máscara completa no texto ou no campo API.
 * NÃO usa sliding window de 20 dígitos (fonte dos fictícios).
 */
export function extractCnjSeguro(
  apiField: string | null | undefined,
  texto: string | null | undefined,
  opts?: { siglaTribunal?: string | null }
): string | null {
  const tryOne = (raw: string): string | null => {
    const d = String(raw || "").replace(/\D/g, "");
    if (d.length !== 20) return null;
    const st = cnjEstruturaPlausivel(d, opts);
    return st.ok ? d : null;
  };

  // 1) campo API se for 20 dígitos válidos
  const fromApi = tryOne(String(apiField || ""));
  if (fromApi) return fromApi;

  const text = String(texto || "");
  // 2) apenas máscaras oficiais no texto
  const re =
    /\b(\d{7})-(\d{2})\.(\d{4})\.(\d)\.(\d{2})\.(\d{4})\b/g;
  let m: RegExpExecArray | null;
  const candidatos: string[] = [];
  while ((m = re.exec(text))) {
    const d = `${m[1]}${m[2]}${m[3]}${m[4]}${m[5]}${m[6]}`;
    const st = cnjEstruturaPlausivel(d, opts);
    if (st.ok) candidatos.push(d);
  }
  // Preferir o que está junto de "Nº" / "Processo"
  const prefer =
    text.match(
      /(?:N[º°o]|Processo)\s*:?\s*(\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4})/i
    )?.[1] || null;
  if (prefer) {
    const d = prefer.replace(/\D/g, "");
    if (cnjEstruturaPlausivel(d, opts).ok) return d;
  }
  return candidatos[0] || null;
}

/** Telefone: não pode ser pedaço de CNJ / protocolo */
export function extractTelefoneSeguro(texto: string | null | undefined): string {
  const t = String(texto || "");
  // remove CNJs mascarados antes de caçar telefone
  const cleaned = t.replace(/\b\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4}\b/g, " ");
  const re = /(?:\+?55\s*)?(?:\(?([1-9]{2})\)?\s*)(?:(9\d{4}|\d{4})[-\s]?(\d{4}))\b/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(cleaned))) {
    const ddd = m[1];
    const p1 = m[2].replace(/\D/g, "");
    const p2 = m[3].replace(/\D/g, "");
    const d = `${ddd}${p1}${p2}`;
    if (d.length !== 10 && d.length !== 11) continue;
    // celular costuma ter 9 após DDD
    if (d.length === 11 && d[2] !== "9") continue;
    if (/^(\d)\1+$/.test(d)) continue;
    return d.length === 11
      ? `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
      : `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  }
  return "";
}

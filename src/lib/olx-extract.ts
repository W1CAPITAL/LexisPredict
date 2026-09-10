/**
 * Extrai nome (se houver), veículo e telefone de texto/URL pública de anúncio OLX
 * colado pelo operador — sem scraping automatizado em massa (LGPD / ToS).
 */

export type OlxLead = {
  nome: string;
  veiculo: string;
  telefone: string;
  cidade: string;
  preco: string;
  rawTitle: string;
};

const PHONE_RE =
  /(?:\+?55\s*)?(?:\(?\d{2}\)?\s*)?(?:9\s*)?\d{4}[-\s.]?\d{4}\b/g;

export function digitsPhone(s: string): string {
  const d = String(s || "").replace(/\D/g, "");
  if (d.length >= 12 && d.startsWith("55")) return d.slice(0, 13);
  return d.slice(0, 11);
}

export function extractPhones(text: string): string[] {
  const out: string[] = [];
  for (const m of String(text || "").match(PHONE_RE) || []) {
    const d = digitsPhone(m);
    if (d.length >= 10 && d.length <= 13) out.push(d);
  }
  return Array.from(new Set(out));
}

/** Heurística de veículo a partir do título/descrição OLX. */
export function extractVeiculo(text: string): string {
  const lines = String(text || "")
    .split(/\n+/)
    .map((l) => l.trim())
    .filter(Boolean);
  const title = lines[0] || "";
  // Padrões comuns: "Fiat Argo 1.0 2022", "Honda CG 160 2020"
  const m = title.match(
    /\b([A-Za-zçãéíóúâêôÁÉÍÓÚÃÕ][A-Za-zçãéíóúâêôÁÉÍÓÚÃÕ\s\-]{1,20})\s+([A-Za-z0-9çãéíóú\.\/\-]{1,20})(?:\s+(\d\.\d))?(?:\s+(19|20)\d{2})?/
  );
  if (m) return m[0].replace(/\s+/g, " ").trim().slice(0, 80);
  return title.slice(0, 80);
}

/** Nome raramente aparece no anúncio; tenta "Vendedor: X" / "Anunciante: X". */
export function extractNomeAnunciante(text: string): string {
  const t = String(text || "");
  const m =
    t.match(/(?:vendedor|anunciante|contato|responsável|responsavel)\s*[:\-]\s*([A-Za-zÀ-ú\s]{3,60})/i) ||
    t.match(/\bme chamo\s+([A-Za-zÀ-ú\s]{3,60})/i);
  if (!m) return "";
  return m[1].replace(/\s+/g, " ").trim().slice(0, 80);
}

export function extractCidade(text: string): string {
  const m = String(text || "").match(
    /\b([A-Za-zÀ-ú\s]{3,40})\s*[-–]\s*([A-Z]{2})\b/
  );
  if (m) return `${m[1].trim()} - ${m[2]}`;
  return "";
}

export function extractPreco(text: string): string {
  const m = String(text || "").match(/R\$\s*[\d.]+(?:,\d{2})?/);
  return m ? m[0] : "";
}

export function parseOlxPaste(text: string): OlxLead {
  const phones = extractPhones(text);
  const veiculo = extractVeiculo(text);
  const nome = extractNomeAnunciante(text);
  return {
    nome,
    veiculo,
    telefone: phones[0] || "",
    cidade: extractCidade(text),
    preco: extractPreco(text),
    rawTitle: String(text || "").split(/\n/)[0]?.trim().slice(0, 120) || "",
  };
}

/** Vários anúncios colados separados por linha em branco. */
export function parseOlxPasteMany(text: string): OlxLead[] {
  const blocks = String(text || "")
    .split(/\n{2,}/)
    .map((b) => b.trim())
    .filter((b) => b.length > 15);
  if (!blocks.length && text.trim()) return [parseOlxPaste(text)];
  return blocks.map(parseOlxPaste).filter((l) => l.veiculo || l.telefone || l.nome);
}

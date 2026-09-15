/** Identificadores publicados no teor; não consulta cadastro de veículos. */
export type VeiculoDjen = { placa: string; renavam: string };

export function formatPlaca(raw: string): string {
  const p = raw.toUpperCase().replace(/[^A-Z0-9]/g, "");
  return /^[A-Z]{3}\d{4}$/.test(p) ? `${p.slice(0, 3)}-${p.slice(3)}` : p;
}

export function extractPlacaFromDjenText(texto: string | null | undefined): string {
  const t = String(texto || "").toUpperCase();
  const labeled = /\bPLACAS?\s*(?:N[.º°O]*\s*)?[:\-]?\s*([A-Z]{3}[ -]?\d[A-Z0-9]\d{2})\b/;
  const bare = /\b([A-Z]{3}[- ]?\d[A-Z0-9]\d{2})\b/;
  const match = t.match(labeled) || t.match(bare);
  return match ? formatPlaca(match[1]) : "";
}

export function extractRenavamFromDjenText(texto: string | null | undefined): string {
  const match = String(texto || "").match(/\bRENAVAM\s*(?:n[.º°o]*\s*)?[:\-]?\s*(\d{9,11})(?!\d)/i);
  return match?.[1] || ""; // Texto: preserva zeros; não afirma validação cadastral.
}

export function extractVeiculoFromDjenText(texto: string | null | undefined): VeiculoDjen {
  return { placa: extractPlacaFromDjenText(texto), renavam: extractRenavamFromDjenText(texto) };
}

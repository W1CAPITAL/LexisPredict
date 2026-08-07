/**
 * Helpers de CNJ — NÃO usar em arquivo "use server".
 * Importar de actions e do client.
 */

export function digitsOnly(s: string): string {
  return String(s || '').replace(/\D/g, '');
}

export function formatCnj(raw: string): string {
  const d = digitsOnly(raw);
  if (d.length !== 20) return String(raw || '').trim();
  return `${d.slice(0, 7)}-${d.slice(7, 9)}.${d.slice(9, 13)}.${d.slice(13, 14)}.${d.slice(14, 16)}.${d.slice(16)}`;
}

/** Extrai primeiro CNJ válido (20 dígitos) de texto OCR/colado */
export function extractCnjFromText(text: string): string | null {
  if (!text) return null;
  const m = text.match(
    /\d{7}[-.]?\d{2}[.]?\d{4}[.]?\d[.]?\d{2}[.]?\d{4}/
  );
  if (!m) return null;
  const d = digitsOnly(m[0]);
  return d.length === 20 ? formatCnj(d) : null;
}
